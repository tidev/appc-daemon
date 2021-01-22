/* eslint-disable promise/always-return, promise/catch-or-return */

import appcdLogger from 'appcd-logger';
import appcdPluginAPIVersion from './plugin-api-version';
import Dispatcher, { DataServiceDispatcher } from 'appcd-dispatcher';
import gawk from 'gawk';
import Response, { codes } from 'appcd-response';
import path from 'path';
import PluginError from './plugin-error';
import PluginPath from './plugin-path';
import semver from 'semver';

import { arrayify } from 'appcd-util';
import { EventEmitter } from 'events';
import { expandPath } from 'appcd-path';
import { isFile } from 'appcd-fs';

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

		// the following 'stop' and 'status' handlers both use a regex for the path match so that
		// scoped package names work properly
		//
		// it's basically the same thing as '/stop|status/:scope?/:pluginName?/:version?', but
		// correctly handles the '@' in the scope name and doesn't throw off the capture group
		// indexes

		this.register(/^\/stop(?:\/(@[^/]+?))?(?:\/([^/]+?))?(?:\/([^/]+?))?(?:\/)?$/, [ 'scope', 'pluginName', 'version' ], async ({ request }) => {
			const { path } = request.data;
			const { scope, pluginName, version } = request.params;
			const name = scope ? `${scope}/${pluginName}` : pluginName;
			const paths = [];
			let code = codes.NOT_FOUND;

			if (name) {
				for (const [ pluginPath, plugin ] of Object.entries(this.registry)) {
					if (plugin.packageName === name && (!version || semver.satisfies(plugin.version, version))) {
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

		this.register(/^\/status(?:\/(@[^/]+?))?(?:\/([^/]+?))?(?:\/([^/]+?))?(?:\/)?$/, [ 'scope', 'pluginName', 'version' ], ({ request }, next) => {
			const { path } = request.data;
			const { scope, pluginName, version } = request.params;
			const name = scope ? `${scope}/${pluginName}` : pluginName;

			const plugins = this.registered
				.filter(plugin => {
					return (!name && !path) || (path && plugin.path === path) || (name && plugin.packageName === name && (!version || semver.satisfies(plugin.version, version)));
				})
				.sort((a, b) => {
					return b.packageName.localeCompare(a.packageName) || semver.rcompare(a.version, b.version);
				});

			if (plugins.length) {
				return version ? plugins[0] : plugins;
			}

			return next();
		});

		this.register('/', new DataServiceDispatcher({
			paths:      this.paths,
			registered: this.registered
		}));
	}

	/**
	 * Initialize the plugin manager by registering the plugin paths and
	 *
	 * @returns {Promise<PluginManager>}
	 * @access public
	 */
	async init() {
		if (!this.initialized) {
			// scan all paths and register any found plugins
			await Promise.all(this.paths.map(dir => dir && this.registerPluginPath(dir)));

			// loop over the list of plugins and figure out which ones should be auto-started
			const pluginsToStart = {};
			for (const ns of Object.values(this.namespaces)) {
				for (const plugin of Object.values(ns.versions)) {
					if (plugin.autoStart) {
						const id = `${plugin.packageName}@${semver.major(plugin.version)}`;
						if (!pluginsToStart[id] || semver.gt(plugin.version, pluginsToStart[id].version)) {
							pluginsToStart[id] = plugin;
						}
					}
				}
			}

			const plugins = Object.values(pluginsToStart);
			if (plugins.length) {
				for (const plugin of plugins) {
					logger.log(`Auto-starting ${highlight(`${plugin.toString()}`)}`);
					try {
						await plugin.start(true);
					} catch (err) {
						logger.error(`Failed to auto-start plugin: ${highlight(plugin.toString())}`);
					}
				}
			} else {
				logger.log('No plugins to auto-start');
			}

			this.initialized = true;
		}

		return this;
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
			.on('added', async plugin => {
				if (this.registry[plugin.path]) {
					logger.error('Plugin already registered: %s', highlight(plugin.toString()));
					return;
				}

				this.registered.push(plugin.info);
				this.registry[plugin.path] = plugin;

				if (plugin.configFile && isFile(plugin.configFile)) {
					logger.log('Registering plugin config file:', highlight(plugin.configFile));
					await Dispatcher.call('/appcd/config', {
						data: {
							action:    'load',
							file:      plugin.configFile,
							id:        `${plugin.packageName}@${plugin.version}`,
							namespace: plugin.name,
							schema:    plugin.configSchemaFile
						}
					});
				}

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
					}

					// add this version to the namespace
					ns.versions[plugin.version] = plugin;
				} else {
					logger.log('Unsupported plugin found: %s', highlight(`${plugin.name}@${plugin.version}`));
				}
			})
			.on('removed', async plugin => {
				try {
					delete this.registry[plugin.path];

					if (plugin.configFile) {
						logger.log('Unregistering plugin config file:', highlight(plugin.configFile));
						try {
							await Dispatcher.call('/appcd/config', {
								data: {
									action: 'unload',
									id:     `${plugin.packageName}@${plugin.version}`
								}
							});
						} catch (err) {
							logger.warn(err);
						}
					}

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
				} catch (e) {
					logger.error(e);
				}
			});

		await this.pluginPaths[pluginPath].detect();
	}

	/**
	 * Stops all external plugins and unregisters all plugin paths.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	shutdown() {
		const paths = Object.keys(this.pluginPaths);
		logger.log(`Shutting down plugin manager and ${highlight(paths.length)} plugin path${paths.length !== 1 ? 's' : ''}`);
		return Promise.all(paths.map(this.unregisterPluginPath.bind(this)));
	}

	/**
	 * Returns an object with the plugin status.
	 *
	 * @returns {Object}
	 */
	status() {
		return {
			apiVersion: appcdPluginAPIVersion,
			paths:      this.paths,
			registered: this.registered
		};
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
}
