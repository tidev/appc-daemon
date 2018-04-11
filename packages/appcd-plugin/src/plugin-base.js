import appcdLogger from 'appcd-logger';
import Dispatcher from 'appcd-dispatcher';
import gawk from 'gawk';
import PluginModule from './plugin-module';

import { EventEmitter } from 'events';

const { highlight } = appcdLogger.styles;

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
		 * The plugin's dispatcher.
		 * @type {Dispatcher}
		 */
		this.dispatcher = new Dispatcher();

		/**
		 * The plugin's namespaced logger.
		 * @type {SnoopLogg}
		 */
		this.logger = appcdLogger(plugin.toString());

		/**
		 * The Appc Daemon config.
		 * @type {Object}
		 */
		this.config = gawk({});

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
			 * The full stack dump if an error occurred.
			 * @type {String}
			 */
			stack: null,

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
		 * The default global object for the plugin sandbox.
		 * @type {Object}
		 */
		this.globals = {
			appcd: {
				call: Dispatcher.call.bind(Dispatcher),
				register: this.dispatcher.register.bind(this.dispatcher)
			},

			console: this.logger
		};

		this.appcdLogger = appcdLogger(plugin.isParent ? 'appcd:plugin:base:parent' : 'appcd:plugin:base:child');
	}

	/**
	 * Loads the plugin's main JS file, evaluates it in a sandbox, and calls its `activate()`
	 * handler.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async activate() {
		const { main } = this.plugin;

		this.appcdLogger.log('Activating plugin: %s', highlight(main));

		const exports = PluginModule.load(this, main);

		this.module = exports && typeof exports === 'object' ? exports : null;

		// call the plugin's activate handler
		if (this.module && typeof this.module.activate === 'function') {
			await this.module.activate(this.config);
		}
	}

	/**
	 * Allows a plugin to cleanup before being unloaded.
	 */
	deactivate() {
		// noop
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
			this.info.startupTime = Date.now() - startTime;
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
