import appcdLogger from 'appcd-logger';
import Dispatcher from 'appcd-dispatcher';
import gawk from 'gawk';
import Response, { codes } from 'appcd-response';
import path from 'path';
import PluginError from './plugin-error';
import PluginPath from './plugin-path';
import semver from 'semver';

import { arrayify } from 'appcd-util';
import { EventEmitter } from 'events';
import { expandPath } from 'appcd-path';

const logger = appcdLogger('appcd:plugin:manager');
const { highlight } = appcdLogger.styles;

/**
 * Detects, starts, and stops Appc Daemon plugins.
 */
export default class PluginManager extends Dispatcher {
	/**
	 * Creates a plugin manager instance.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {Array.<String>} [opts.paths] - A list of paths to scan for plugins.
	 * @access public
	 */
	constructor(opts = {}) {
		if (!opts || typeof opts !== 'object') {
			throw new TypeError('Expected options to be an object');
		}

		super();

		const emitter = new EventEmitter();
		this.on = emitter.on.bind(emitter);

		this.register('/register', ctx => {
			return this.registerPluginPath(ctx.request.data.path)
				.then(() => new Response(codes.PLUGIN_REGISTERED))
				.catch(err => {
					logger.warn(err);
					throw err;
				});
		});

		this.register('/unregister', ctx => {
			return this.unregisterPluginPath(ctx.request.data.path)
				.then(() => new Response(codes.PLUGIN_UNREGISTERED))
				.catch(err => {
					logger.warn(err);
					throw err;
				});
		});

		this.register('/stop/:pluginName?/:version?', async ({ request }) => {
			const { path } = request.data;
			const { pluginName, version } = request.params;
			const paths = [];
			let code = codes.NOT_FOUND;

			if (pluginName) {
				for (const [ pluginPath, plugin ] of Object.entries(this.registry)) {
					if (plugin.packageName === pluginName && (!version || semver.satisfies(plugin.version, version))) {
						paths.push(pluginPath);
					}
				}
			} else if (!path) {
				throw new PluginError('Missing name or path of plugin to stop');
			} else if (this.registry[path]) {
				paths.push(path);
			}

			for (const pluginPath of paths) {
				const plugin = this.registry[pluginPath];
				if (plugin) {
					if (plugin.type === 'internal') {
						code = code === codes.OK ? code : codes.PLUGIN_CANNOT_STOP_INTERNAL_PLUGIN;
					} else if (!plugin.impl || !plugin.info.pid) {
						code = code === codes.OK ? code : codes.PLUGIN_ALREADY_STOPPED;
					} else {
						await plugin.stop();
						code = codes.OK;
					}
				}
			}

			return new Response(code);
		});

		this.register('/', () => this.status());

		this.register('/status/:pluginName?/:version?', ({ request }) => {
			const { path } = request.data;
			const { pluginName, version } = request.params;
			let results = [];

			for (const [ pluginPath, plugin ] of Object.entries(this.registry)) {
				if ((!pluginName && !path) || (path && plugin.path === path) || (pluginName && plugin.packageName === pluginName && (!version || semver.satisfies(plugin.version, version)))) {
					results.push(plugin.info);
				}
			}

			return results;
		});

		/**
		 * A map of namespaces to versions to plugins
		 * @access private
		 */
		this.namespaces = {};

		/**
		 * A map of plugin search paths to the list of plugins found in that path.
		 * @type {Object}
		 * @access private
		 */
		this.pluginPaths = {};

		// register all paths and detect plugins
		if (opts.paths && !Array.isArray(opts.paths)) {
			throw new TypeError('Expected paths option to be an array');
		}

		/**
		 * The list of all paths to scan for plugins.
		 * @type {Array.<String>}
		 */
		this.paths = arrayify(opts.paths, true);

		/**
		 * A list of all detected plugins. Plugins are added and removed automatically.
		 * @type {GawkArray}
		 * @access private
		 */
		this.registered = gawk.watch(gawk([]), (obj, src) => emitter.emit('change', obj, src));

		/**
		 * A map of all registered plugins by path.
		 * @type {Object}
		 */
		this.registry = {};

		/**
		 * Indicates that telemetry data should be captured.
		 *
		 * NOTE: This property MUST be set AFTER doing the initial path scanning and plugin
		 * registration.
		 *
		 * @type {Boolean}
		 */
		this.telemetryEnabled = true;

		// register all plugins the initial list of paths
		for (const dir of this.paths) {
			if (dir) {
				this.registerPluginPath(dir);
			}
		}
	}

	/**
	 * Registers a plugin path and all of the plugins contained.
	 *
	 * @param {String} pluginPath - The plugin path to register and all contained plugins.
	 * @returns {Promise}
	 * @access public
	 */
	async registerPluginPath(pluginPath) {
		if (!pluginPath || typeof pluginPath !== 'string') {
			throw new PluginError('Invalid plugin path');
		}

		pluginPath = expandPath(pluginPath);
		logger.log('Registering plugin path: %s', highlight(pluginPath));

		if (this.pluginPaths[pluginPath]) {
			throw new PluginError(codes.PLUGIN_PATH_ALREADY_REGISTERED);
		}

		// verify no parent path has already been registered
		let parentPath = pluginPath;
		while (parentPath) {
			const p = path.dirname(parentPath);
			if (this.pluginPaths[p]) {
				throw new PluginError(codes.PLUGIN_PATH_PARENT_DIRECTORY_ALREADY_REGISTERED);
			}
			if (p === parentPath) {
				break;
			}
			parentPath = p;
		}

		// validate that no child path has already been registered
		const prefixed = pluginPath + path.sep;
		for (const pp of Object.keys(this.pluginPaths)) {
			if (pp.indexOf(prefixed) === 0) {
				throw new PluginError(codes.PLUGIN_PATH_SUBDIRECTORY_ALREADY_REGISTERED);
			}
		}

		this.pluginPaths[pluginPath] = new PluginPath(pluginPath)
			.on('added', plugin => {
				if (this.registry[plugin.path]) {
					logger.error('Plugin already registered: %s', highlight(plugin.toString()));
					return;
				}

				this.registered.push(plugin.info);
				this.registry[plugin.path] = plugin;

				if (plugin.supported) {
					logger.log('Plugin found: %s', highlight(`${plugin.name}@${plugin.version}`));

					let ns = this.namespaces[plugin.name];

					if (!ns) {
						// initialize the namespace
						ns = this.namespaces[plugin.name] = {
							handler: async (ctx, next) => {
								const versions = Object.keys(ns.versions).sort(semver.rcompare);
								let version = ctx.request.params.version || null;

								if (!version) {
									logger.log('No version specified, return list of versions');
									ctx.response = versions;
									return;
								}

								let plugin = ns.versions[version];
								if (!plugin) {
									if (version === 'latest') {
										version = versions[0];
										logger.log('Remapping plugin version %s -> %s', highlight('latest'), highlight(version));
										plugin = version && ns.versions[version];
									} else {
										for (const v of versions) {
											if (semver.satisfies(v, version)) {
												logger.log('Remapping plugin version %s -> %s', highlight(version), highlight(v));
												plugin = ns.versions[v];
												break;
											}
										}

										if (!plugin) {
											// while technically not semver, loop over the versions
											// again, but this time convert any pre-release versions
											// to regular versions
											for (const v of versions) {
												const p = v.indexOf('-');
												if (p !== -1 && semver.satisfies(v.substring(0, p), version)) {
													logger.log('Remapping plugin version %s -> %s', highlight(version), highlight(v));
													plugin = ns.versions[v];
													break;
												}
											}
										}
									}
								}

								if (plugin) {
									// forward request to the plugin's dispatcher
									ctx.path = '/' + (ctx.request.params.path || '');

									logger.log('Starting plugin %s', highlight(plugin.toString()));
									try {
										await plugin.start();
									} catch (e) {
										if (ctx.path === '/') {
											// the plugin failed to load... possibly due to syntax error
											return plugin.info;
										}
										throw e;
									}

									if (plugin.error) {
										logger.log('Plugin %s errored during start', highlight(plugin.toString()));
									} else {
										logger.log('Plugin %s started', highlight(plugin.toString()));
									}

									return plugin.dispatch(ctx, next);
								}

								// not found, continue
								return next();
							},
							path: `/${plugin.name}/:version?/:path*`,
							versions: {}
						};

						Dispatcher.register(ns.path, ns.handler);
					} else {

						logger.log('Unsupported plugin found: %s', highlight(`${plugin.name}@${plugin.version}`));
					}

					// add this version to the namespace
					ns.versions[plugin.version] = plugin;
				}

				this.sendTelemetry('plugin.added', plugin);
			})
			.on('removed', async (plugin) => {
				try {
					delete this.registry[plugin.path];

					for (let i = 0; i < this.registered.length; i++) {
						if (this.registered[i].path === plugin.path) {
							this.registered.splice(i, 1);
							break;
						}
					}

					let ns = this.namespaces[plugin.name];
					if (ns && ns.versions[plugin.version]) {
						delete ns.versions[plugin.version];

						if (Object.keys(ns.versions).length === 0) {
							Dispatcher.unregister(ns.path, ns.handler);
							delete this.namespaces[plugin.name];
						}
					}

					this.sendTelemetry('plugin.removed', plugin);
				} catch (e) {
					logger.error(e);
				}
			});

		await this.pluginPaths[pluginPath].detect();
	}

	/**
	 * Creates a telemetry event.
	 *
	 * @param {String} event - The name of the telemetry event.
	 * @param {Plugin} plugin - A reference to the plugin that was added or removed.
	 * @access private
	 */
	sendTelemetry(event, plugin) {
		if (!this.telemetryEnabled) {
			return;
		}

		Dispatcher
			.call('/appcd/telemetry', {
				event,
				plugin: {
					name:    plugin.name,
					path:    plugin.path,
					version: plugin.version
				},
				plugins:     this.registered.map(p => {
					const info = {
						name:        p.name,
						nodeVersion: p.nodeVersion,
						path:        p.path,
						version:     p.version,
						type:        p.type
					};
					if (p.error) {
						info.error = p.error;
					}
					return info;
				})
			})
			.catch(() => {
				// squelch
			});
	}

	/**
	 * Stops all external plugins associated with the specified `pluginPath` and unregisters the
	 * `PluginPath` instance as long as it has no internal plugins.
	 *
	 * @param {String} pluginPath - The plugin path to unregister.
	 * @returns {Promise}
	 * @access public
	 */
	async unregisterPluginPath(pluginPath) {
		if (!pluginPath || typeof pluginPath !== 'string') {
			throw new PluginError('Invalid plugin path');
		}

		pluginPath = expandPath(pluginPath);
		logger.log('Unregistering plugin path: %s', highlight(pluginPath));

		if (!this.pluginPaths[pluginPath]) {
			throw new PluginError(codes.PLUGIN_PATH_NOT_REGISTERED);
		}

		await this.pluginPaths[pluginPath].destroy();
		delete this.pluginPaths[pluginPath];
	}

	/**
	 * Stops all external plugins and unregisters all plugin paths.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	shutdown() {
		const paths = Object.keys(this.pluginPaths);
		logger.log(appcdLogger.pluralize(`Shutting down plugin manager and ${highlight(paths.length)} plugin path`, paths.length));
		return Promise.all(paths.map(this.unregisterPluginPath.bind(this)));
	}

	/**
	 * Returns an object with the plugin status.
	 *
	 * @returns {Object}
	 */
	status() {
		return {
			paths:      this.paths,
			registered: this.registered
		};
	}

	/**
	 * Generates a snapshot of the collected data across all active plugins.
	 *
	 * @returns {Promise<Array<Object>>}
	 * @access public
	 */
	health() {
		return Promise
			.all(Object.values(this.registry).map(plugin => plugin.health()))
			.then(results => {
				results = [].concat.apply([], results);
				return results.filter(n => n);
			});
	}
}
