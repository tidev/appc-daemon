import appcdLogger from 'appcd-logger';
import Dispatcher from 'appcd-dispatcher';
import gawk from 'gawk';
import Response, { codes } from 'appcd-response';
import path from 'path';
import PluginError from './plugin-error';
import PluginPath from './plugin-path';
import semver from 'semver';

import { EventEmitter } from 'events';
import { expandPath } from 'appcd-path';

const logger = appcdLogger('appcd:plugin:manager');
const { highlight } = appcdLogger.styles;

/**
 * Detects, starts, and stops Appc Daemon plugins.
 */
export default class PluginManager extends EventEmitter {
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

		/**
		 * The plugin manager dispatcher.
		 * @type {Dispatcher}
		 */
		this.dispatcher = new Dispatcher()
			.register('/register', ctx => {
				return this.register(ctx.request.data.path)
					.then(() => {
						ctx.response = new Response(codes.PLUGIN_REGISTERED);
						return ctx;
					})
					.catch(err => {
						logger.warn(err);
						throw err;
					});
			})
			.register('/unregister', ctx => {
				return this.unregister(ctx.request.data.path)
					.then(() => {
						ctx.response = new Response(codes.PLUGIN_UNREGISTERED);
						return ctx;
					})
					.catch(err => {
						logger.warn(err);
						throw err;
					});
			})
			.register('/status', ctx => {
				ctx.response = this.plugins;
			});

		/**
		 * A map of namespaces to versions to plugins
		 * @access private
		 */
		this.namespaces = {};

		/**
		 * A list of all detected plugins. Plugins are added and removed automatically.
		 * @type {GawkArray}
		 * @access private
		 */
		this.plugins = gawk.watch(gawk([]), (obj, src) => this.emit('change', obj, src));

		/**
		 * A map of plugin search paths to the list of plugins found in that path.
		 * @type {Object}
		 * @access private
		 */
		this.pluginPaths = {};

		// register all paths and detect plugins
		if (opts.paths) {
			if (!Array.isArray(opts.paths)) {
				throw new TypeError('Expected paths option to be an array');
			}

			for (let dir of opts.paths) {
				if (dir) {
					this.register(dir);
				}
			}
		}

		/**
		 * Indicates that telemetry data should be captured.
		 *
		 * NOTE: This property MUST be set AFTER doing the initial path scanning and plugin
		 * registration.
		 *
		 * @type {Boolean}
		 */
		this.telemetryEnabled = true;
	}

	/**
	 * Registers a plugin path and all of the plugins contained.
	 *
	 * @param {String} pluginPath - The plugin path to register and all contained plugins.
	 * @returns {Promise}
	 * @access public
	 */
	async register(pluginPath) {
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
				if (this.plugins.indexOf(plugin) !== -1) {
					return;
				}

				logger.log('Plugin added: %s', highlight(`${plugin.name}@${plugin.version}`));

				// sanity check the plugin hasn't been added twice
				for (let i = 0; i < this.plugins.length; i++) {
					if (this.plugins[i].path === plugin.path || (this.plugins[i].name === plugin.name && this.plugins[i].version === plugin.version)) {
						logger.error('Plugin already registered: %s', highlight(plugin.toString()));
						return;
					}
				}

				this.plugins.push(plugin.info);

				let ns = this.namespaces[plugin.name];

				if (!ns) {
					// initialize the namespace
					ns = this.namespaces[plugin.name] = {
						handler: async (ctx, next) => {
							const versions = Object.keys(ns.versions).sort(semver.rcompare);
							let version = ctx.params.version || null;

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
								} else {
									for (const v of versions) {
										if (semver.satisfies(v, version)) {
											logger.log('Remapping plugin version %s -> %s', highlight(version), highlight(v));
											version = v;
											break;
										}
									}
								}

								plugin = version && ns.versions[version];
							}

							if (plugin && !plugin.error) {
								// forward request to the plugin's dispatcher
								ctx.path = '/' + (ctx.params.path || '');
								await plugin.start();
								logger.log('Plugin %s started', highlight(plugin.toString()));
								return await plugin.dispatch(ctx, next);
							}

							// not found, continue
							return await next();
						},
						path: `/${plugin.name}/:version?/:path*`,
						versions: {}
					};

					Dispatcher.register(ns.path, ns.handler);
				}

				// add this version to the namespace
				ns.versions[plugin.version] = plugin;

				this.sendTelemetry('plugin.added', plugin);
			})
			.on('removed', async (plugin) => {
				try {
					logger.log('Stopping plugin: %s', highlight(`${plugin.name}@${plugin.version}`));
					await plugin.stop();

					for (let i = 0; i < this.plugins.length; i++) {
						if (this.plugins[i].path === plugin.path) {
							this.plugins.splice(i, 1);
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
				plugins:     this.plugins.map(p => {
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
				// squeltch
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
	async unregister(pluginPath) {
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
		return Promise.all(
			Object
				.keys(this.pluginPaths)
				.map(this.unregister.bind(this))
		);
	}
}
