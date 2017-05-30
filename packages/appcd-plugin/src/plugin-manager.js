import Dispatcher from 'appcd-dispatcher';
import fs from 'fs';
import gawk from 'gawk';
import path from 'path';
import PluginError from './plugin-error';
import Plugin from './plugin';
import Response, { codes } from 'appcd-response';
import semver from 'semver';
import snooplogg from 'snooplogg';

import { EventEmitter } from 'events';
import { expandPath } from 'appcd-path';
import { isDir, isFile } from 'appcd-fs';

const logger = snooplogg.config({ theme: 'detailed' })('appcd:plugin:manager');
const { highlight, note } = snooplogg.styles;

// TODO:
//   start external plugins
//   plugin host
//   stop external plugins
//   watch external plugin for exit
//   restart external plugin if crashes

//   external plugin process stats (mem, etc)

//   watch fs and reload plugin
//   namespaced dispatcher?
//   namespaced router?

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
		 * A list of paths that contain plugin packages.
		 * @type {Array.<String>}
		 */
		this.paths = [];

		if (opts.paths) {
			if (!Array.isArray(opts.paths)) {
				throw new TypeError('Expected paths option to be an array');
			}

			for (const dir of opts.paths) {
				if (dir) {
					this.paths.push(expandPath(dir));
				}
			}
		}

		/**
		 * A list of all detected plugins.
		 * @type {GawkArray}
		 */
		this.plugins = gawk([]);

		/**
		 * A map of plugin namespaces to plugin version dispatchers.
		 * @type {Object}
		 */
		this.namespaces = {};

		/**
		 * The plugin manager dispatcher.
		 * @type {Dispatcher}
		 */
		this.dispatcher = new Dispatcher()
			.register('/register', ctx => {
				try {
					this.register(ctx.payload.data.path);
					ctx.response = new Response(codes.PLUGIN_REGISTERED);
				} catch (e) {
					logger.warn(e.message);
					ctx.response = new Response(e);
				}
			})
			.register('/unregister', async (ctx) => {
				const pluginPath = ctx.payload.data.path;
				if (!pluginPath) {
					throw new PluginError(codes.PLUGIN_BAD_REQUEST);
				}
				await this.unregister(pluginPath);
				ctx.response = new Response(codes.PLUGIN_UNREGISTERED);
			})
			.register('/status', ctx => {
				ctx.response = this.plugins;
			});

		gawk.watch(this.plugins, (obj, src) => this.emit('change', obj, src));
	}

	/**
	 * Scans each path for a plugin and registers them.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	start() {
		return Promise.all(this.paths.map(dir => {
			// detect and register all plugins in `dir`
			this.detect(dir);

			// start watching the directory for changes
			return Dispatcher
				.call('/appcd/fs/watch', { data: { path: dir }, type: 'subscribe' })
				.then(ctx => {
					ctx.response.on('data', evt => {
						if (evt.type === 'publish') {
							// TODO: re-detect
							// figure out what changed, then register/unregister
							console.log(evt);
						}
					});
				});
		}));
	}

	/**
	 * Detect and register all plugins in the given directory.
	 *
	 * @param {String} dir - The directory to scan for plugins.
	 * @access private
	 */
	detect(dir) {
		if (!isDir(dir)) {
			return;
		}

		logger.log('Scanning for plugins: %s', highlight(dir));

		const versionRegExp = /^\d\.\d\.\d$/;

		const tryRegisterPlugin = dir => {
			if (isFile(path.join(dir, 'package.json'))) {
				// we have an NPM-style plugin
				try {
					try {
						this.register(dir);
					} catch (e) {
						logger.warn(e.message);
					}
					return true;
				} catch (e) {
					logger.warn('Invalid plugin: %s', highlight(dir));
					logger.warn(e.message);
				}
			}
		};

		if (!tryRegisterPlugin(dir)) {
			for (const name of fs.readdirSync(dir)) {
				const subdir = path.join(dir, name);
				if (isDir(subdir) && !tryRegisterPlugin(subdir)) {
					// we have a versioned plugin
					for (const name of fs.readdirSync(subdir)) {
						if (versionRegExp.test(name)) {
							tryRegisterPlugin(path.join(subdir, name));
						}
					}
				}
			}
		}
	}

	/**
	 * Registers a plugin and sends out notifications.
	 *
	 * @param {String} plugin - The path to the plugin to register.
	 * @access public
	 */
	register(pluginPath) {
		const plugin = new Plugin(pluginPath);

		logger.log('Registering plugin: %s', highlight(`${plugin.name}@${plugin.version}`));

		// check to make sure we don't insert the same plugin twice
		for (const p of this.plugins) {
			if (p.namespace === plugin.namespace && p.version === plugin.version) {
				throw new PluginError(codes.PLUGIN_ALREADY_REGISTERED);
			}
		}

		// initialize the namespace dispatcher
		let ns = this.namespaces[plugin.namespace];
		if (!ns) {
			ns = this.namespaces[plugin.namespace] = {
				dispatcher: this.createNamespaceDispatcher(plugin.namespace),
				versions: {}
			};
			Dispatcher.register(`/${plugin.namespace}`, ns.dispatcher);
		}

		// TODO: the Dispatcher below should probably go in the Plugin instance, but should
		// really be the dispatcher in the plugin host... not sure how to do that
		ns.versions[plugin.version] = new Dispatcher().register('/', ctx => { ctx.response = 'whoo!'; });

		logger.log('Found plugin: %s', highlight(`${plugin.name}@${plugin.version}`), note(plugin.path));

		this.plugins.push(plugin);
	}

	/**
	 * Unregisters a plugin and sends out notifications.
	 *
	 * @param {Plugin|String} pluginOrPath - The plugin info object or plugin path.
	 * @access public
	 */
	async unregister(pluginOrPath) {
		let pluginPath = pluginOrPath instanceof Plugin ? pluginOrPath.path : pluginOrPath;

		if (pluginPath && typeof pluginPath === 'string') {
			pluginPath = expandPath(pluginPath);

			for (let i = 0; i < this.plugins.length; i++) {
				if (this.plugins[i].path === pluginPath) {
					// if (this.plugins[i].active) {
					// 	if (this.plugins[i].type === 'internal') {
					// 		throw new PluginError('Cannot unregister running internal plugins');
					// 	}
					// 	await this.plugins[i].stop();
					// }
					this.plugins.splice(i--, 1);
					return;
				}
			}
		}

		throw new PluginError(codes.PLUGIN_NOT_REGISTERED);
	}

	/**
	 * Stops all running plugins.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	shutdown() {
		return Promise
			// stop all fs watchers
			.all(this.paths.map(topic => {
				return Dispatcher.call('/appcd/fs/watch', { topic, type: 'unsubscribe' });
			}))

			// unload all plugins
			.then(async () => {
				for (let i = 0; i < this.plugins; i++) {
					const plugin = this.plugins[i];
					logger.log('Stopping %s', highlight(`${plugin.name}@${plugin.version}`));
					try {
						// await plug.unload();
					} catch (e) {
						if (err.code !== codes.PLUGIN_ALREADY_STOPPED) {
							throw err;
						}
					}
					this.plugins.splice(i--, 1);
				}
			});
	}

	/**
	 * Creates a dispatcher for the given namespace and wires up the default version routes.
	 *
	 * @param {String} namespace - The namespace to tie the dispatcher to.
	 * @returns {Dispatcher}
	 * @access private
	 */
	createNamespaceDispatcher(namespace) {
		return new Dispatcher()
			.register('/:version?/:path*', async (ctx, next) => {
				const ns = this.namespaces[namespace];
				const versions = Object.keys(ns.versions).sort(semver.rcompare);
				let version = ctx.params.version || null;

				if (version === null) {
					// if just the plugin namespace is requested, return an object with all valid
					// versions
					logger.log('No version specified, return list of versions');
					ctx.response = {
						latest: `/${namespace}/latest`
					};
					for (const version of versions) {
						ctx.response[version] = `/${namespace}/${version}`;
					}
					return;
				}

				logger.log('Version = %s', highlight(version));
				if (version === 'latest') {
					version = versions[0];
					logger.log('Remapping latest version as %s', highlight(version));
				}

				if (ns.versions[version]) {
					logger.log('Dispatching to plugin version %s', highlight(version));
					return ns.versions[version].call(`/${ctx.params.path || ''}`, ctx);
				}

				// no match, continue
				logger.log('No version match');
				await next();
			});
	}
}
