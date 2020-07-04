import appcdLogger from 'appcd-logger';
import Dispatcher from 'appcd-dispatcher';
import gawk from 'gawk';
import PluginModule from './plugin-module';

import { EventEmitter } from 'events';
import { watch, unwatch } from './helpers';

const { alert, highlight, ok } = appcdLogger.styles;

/**
 * The plugin state.
 * @type {Object}
 */
export const states = {
	STOPPED:  'stopped',
	STARTING: 'starting',
	STARTED:  'started',
	STOPPING: 'stopping'
};

/**
 * The base class for internal and external plugin implementations.
 */
export default class PluginBase extends EventEmitter {
	/**
	 * Initializes the plugin's logger, global object, and state.
	 *
	 * @param {Plugin} plugin - A reference to the plugin instance.
	 * @access public
	 */
	constructor(plugin) {
		super();

		/**
		 * The Appc Daemon config.
		 * @type {Object}
		 */
		this.config = gawk({});

		/**
		 * The appcd config subscription id used to unsubscribe.
		 */
		this.configSubscriptionId = null;

		/**
		 * The plugin's dispatcher.
		 * @type {Dispatcher}
		 */
		this.dispatcher = new Dispatcher();

		/**
		 * Plugin runtime information.
		 * @type {Object}
		 */
		this.info = gawk({
			/**
			 * @type {Error}
			 */
			error: null,

			/**
			 * The exit code for when an external plugin exits unexpectedly.
			 * @type {Number}
			 */
			exitCode: null,

			/**
			 * The external plugin process' id.
			 * @type {Number}
			 */
			pid: null,

			/**
			 * A list of all known registered services after the plugin has been activated.
			 * @type {Array}
			 */
			services: [],

			/**
			 * The full stack dump if an error occurred.
			 * @type {String}
			 */
			stack: null,

			/**
			 * The timestamp the plugin was activated.
			 * @type {Number}
			 */
			startTime: null,

			/**
			 * The number of milliseconds it took for the module to activate.
			 * @type {Number}
			 */
			startupTime: null,

			/**
			 * The current state of the plugin.
			 * @type {String}
			 */
			state: states.STOPPED,

			/**
			 * External plugin agent stats.
			 * @type {Object}
			 */
			stats: {}
		});

		/**
		 * The plugin's namespaced logger.
		 * @type {SnoopLogg}
		 */
		this.logger = appcdLogger(`appcd:plugin:base:${plugin.isParent ? 'parent' : 'child'}`);

		/**
		 * The plugin's exports.
		 * @type {Object}
		 */
		this.module = null;

		/**
		 * The plugin reference.
		 * @type {Plugin}
		 */
		this.plugin = plugin;

		/**
		 * The default global object for the plugin sandbox.
		 * @type {Object}
		 */
		this.globals = {
			appcd: {
				call: async (path, payload) => {
					if (typeof path !== 'string') {
						throw new TypeError('Expected path to be a string');
					}

					const event = `${this.plugin.name}.${path ? `${path.replace(/\?.*$/, '').replace(/[^\w]+/g, '.').replace(/^\.|\.$/g, '')}` : 'dispatch'}`;
					const startTime = Date.now();

					try {
						const ctx = await Dispatcher.call(path, payload);
						this.globals.appcd.telemetry({
							event,
							path,
							payload,
							startTime,
							status: ctx.status
						});
						return ctx;
					} catch (error) {
						if (error.telemetry !== false) {
							// some errors, such as prompt related errors, we don't want to record
							this.globals.appcd.telemetry({
								error,
								event,
								path,
								payload,
								startTime
							});
						}
						throw error;
					}
				},
				fs: {
					watch,
					unwatch
				},
				logger: appcdLogger,
				register: this.dispatcher.register.bind(this.dispatcher),
				telemetry: async payload => {
					try {
						const { error, event, startTime } = payload;

						if (!event || typeof event !== 'string') {
							throw new TypeError('Expected event name to be a non-empty string');
						}

						const app = this.config[this.plugin.name]?.telemetry?.app;
						if (!app) {
							// plugin does not have not have an app guid, ignoring
							this.appcdLogger.log(`Plugin ${highlight(`${this.plugin.name}@${this.plugin.version}`)} does not have an app guid, skipping telemetry event "${event}"`);
							return;
						}

						const data = {
							...payload,
							app,
							plugin: {
								name:        this.plugin.name,
								packageName: this.plugin.packageName,
								version:     this.plugin.version
							}
						};

						delete data.error;
						delete data.startTime;

						if (startTime !== undefined) {
							if (typeof startTime !== 'number' || startTime <= 0) {
								throw new TypeError('Expected start time to be a positive integer');
							}
							data.responseTime = Date.now() - startTime;
						}

						let endpoint = '/appcd/telemetry';
						if (error) {
							endpoint = '/appcd/telemetry/crash';
							data.message = error.toString();
							data.error   = error.stack;
							data.status  = error.status;
						}

						await Dispatcher.call(endpoint, data);
					} catch (err) {
						this.appcdLogger.warn(err.stack);
					}
				}
			},

			console: this.logger.console
		};

		this.appcdLogger = appcdLogger(plugin.isParent ? 'appcd:plugin:base:parent' : 'appcd:plugin:base:child');
	}

	/**
	 * Loads the plugin's main JS file, evaluates it in a sandbox, and calls its `activate()`
	 * handler.
	 *
	 * Note: For external plugins, this method is called in the child process.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async activate() {
		const { main } = this.plugin;

		this.appcdLogger.log('Activating plugin: %s', highlight(main));

		const exports = PluginModule.load(this, main, true);

		this.module = exports && typeof exports === 'object' ? exports : null;

		// call the plugin's activate handler
		if (this.module && typeof this.module.activate === 'function') {
			await this.module.activate(this.config);
		}

		// detect the plugin services
		(function scan(services, dispatcher, parent = '') {
			for (const { path, handler } of dispatcher.routes) {
				if (path !== '/') {
					services.push(parent + path);
				}
				if (handler instanceof Dispatcher) {
					scan(services, handler, parent + path);
				}
			}
			return services;
		}(this.info.services = [], this.dispatcher));
	}

	/**
	 * Allows a plugin to cleanup before being unloaded.
	 */
	deactivate() {
		// noop
	}

	/**
	 * Initializes the plugin implementation by wiring up the config watcher.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async init() {
		try {
			const { response } = await Dispatcher.call('/appcd/config', { type: 'subscribe' });

			await new Promise(resolve => {
				response.on('data', ({ message, sid, type }) => {
					if (type === 'subscribe') {
						this.configSubscriptionId = sid;
					} else if (type === 'event') {
						gawk.set(this.config, message);
						resolve(); // no biggie if this gets called every config update
					}
				});
			});
		} catch (err) {
			this.appcdLogger.warn('Failed to subscribe to config');
			this.appcdLogger.warn(err);
		}
	}

	/**
	 * Prints the status of the request and dispatches a telemetry event.
	 *
	 * @param {Object} opts - Various options.
	 * @param {Object} opts.ctx - A dispatcher context.
	 * @param {Number} opts.startTime - The timestamp of when the plugin began to handle the
	 * incoming request.
	 * @access private
	 */
	logRequest({ ctx, startTime }) {
		const style = ctx.status < 400 ? ok : alert;
		let msg = `Plugin dispatcher: ${highlight(`/${this.plugin.name}/${this.plugin.version}${ctx.path}`)} ${style(ctx.status)}`;
		if (ctx.type !== 'event') {
			msg += ` ${highlight(`${new Date() - startTime}ms`)}`;
		}
		this.appcdLogger.log(msg);
	}

	/**
	 * Sets the plugin state and emits the `state` event if it is changed.
	 *
	 * @param {String} state - The new state.
	 * @param {Error} [err] - An optional error to pass along with the state change event.
	 * @returns {Plugin}
	 * @access private
	 */
	setState(state, err) {
		if (state !== this.info.state) {
			this.info.state = state;
			this.emit('state', state, err);
		}
		return this;
	}

	/**
	 * Loads and activates an internal plugin.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async start() {
		if (this.info.state === states.STARTED) {
			this.appcdLogger.log('Plugin %s already started', highlight(this.plugin.toString()));
			return;
		}

		if (this.info.state === states.STARTING) {
			this.appcdLogger.log('Plugin %s already starting... waiting', highlight(this.plugin.toString()));
			await this.waitUntil(states.STARTED);
			return;
		}

		// if the plugin is stopping, then wait for it to finish stopping
		if (this.info.state === states.STOPPING) {
			this.appcdLogger.log('Plugin %s stopping... waiting to start', highlight(this.plugin.toString()));
			await this.waitUntil(states.STOPPED);
		}

		// the plugin is stopped and can now be started
		this.setState(states.STARTING);
		try {
			const startTime = Date.now();
			await this.onStart();
			this.info.startTime = Date.now();
			this.info.startupTime = this.info.startTime - startTime;
			this.setState(states.STARTED);
		} catch (e) {
			this.setState(states.STOPPED);
			throw e;
		}
	}

	/**
	 * Stops the plugin.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async stop() {
		this.info.stats = {};

		// if the plugin is already stopped, then nothing to do
		if (this.info.state === states.STOPPED) {
			this.appcdLogger.log('Plugin %s already stopped', highlight(this.plugin.toString()));
			this.deactivate();
			return;
		}

		// if the plugin is already stopping, then wait for it to be stopped before resolving
		if (this.info.state === states.STOPPING) {
			this.appcdLogger.log('Plugin %s already stopping... waiting', highlight(this.plugin.toString()));
			await this.waitUntil(states.STOPPED);
			this.appcdLogger.log('Plugin %s finally stopped', highlight(this.plugin.toString()));
			return;
		}

		// the plugin is starting/started and can now be stopped

		this.appcdLogger.log('Deactivating plugin: %s', highlight(this.plugin.main));

		if (this.info.state === states.STARTED) {
			this.setState(states.STOPPING);
		}

		try {
			await this.onStop();
		} catch (e) {
			this.info.error = e.message;
			this.info.stack = e.stack;
		} finally {
			this.info.startTime = null;
			this.deactivate();
		}
	}

	/**
	 * Returns a promise that waits until the plugin's state changes to the desired value.
	 *
	 * @param {String} state - The desired state.
	 * @returns {Promise}
	 * @access private
	 */
	waitUntil(state) {
		return new Promise((resolve, reject) => {
			const fn = (currentState, err) => {
				if (err) {
					this.removeListener('state', fn);
					reject(err);
				} else if (currentState === state) {
					this.removeListener('state', fn);
					resolve();
				}
			};

			this.on('state', fn);
		});
	}
}
