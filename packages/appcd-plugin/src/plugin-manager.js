import Dispatcher from 'appcd-dispatcher';
import gawk from 'gawk';
import Response, { codes } from 'appcd-response';
import path from 'path';
import PluginError from './plugin-error';
import PluginPath from './plugin-path';
import snooplogg from 'snooplogg';

import { EventEmitter } from 'events';
import { expandPath } from 'appcd-path';

const logger = snooplogg.config({ theme: 'detailed' })('appcd:plugin:manager');
const { highlight } = snooplogg.styles;

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
				try {
					this.registry.register(ctx.request.data.path, ctx.request.data.start);
					ctx.response = new Response(codes.PLUGIN_REGISTERED);
				} catch (e) {
					logger.warn(e);
					throw e;
				}
			})
			.register('/unregister', async (ctx) => {
				try {
					await this.unregister(ctx.request.data.path);
					ctx.response = new Response(codes.PLUGIN_UNREGISTERED);
				} catch (e) {
					logger.warn(e);
					throw e;
				}
			})
			.register('/status', ctx => {
				ctx.response = this.plugins;
			});

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
					this.register(dir, true);
				}
			}
		}
	}

	/**
	 * Registers a plugin path and all of the plugins contained.
	 *
	 * @param {String} pluginPath - The plugin path to register and all contained plugins.
	 * @param {Boolean} start - When `true`, starts all plugins foudn in the path.
	 * @returns {PluginPath}
	 * @access public
	 */
	register(pluginPath, start) {
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
				if (this.plugins.indexOf(plugin) === -1) {
					logger.log('Plugin added: %s', highlight(`${plugin.name}@${plugin.version}`));
					this.plugins.push(plugin.info);
					if (start) {
						plugin.start();
					}
				}
			})
			.on('removed', plugin => {
				const p = this.plugins.indexOf(plugin);
				if (p !== -1) {
					logger.log('Plugin removed: %s', highlight(`${plugin.name}@${plugin.version}`));
					this.plugins.splice(p, 1);
				}
			})
			.detect();

		return this.pluginPaths[pluginPath];
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

		try {
			await this.pluginPaths[pluginPath].destroy();
			delete this.pluginPaths[pluginPath];
		} catch (e) {
			logger.warn(e);
		}
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
