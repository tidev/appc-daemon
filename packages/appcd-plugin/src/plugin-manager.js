import Dispatcher, { ServiceDispatcher } from 'appcd-dispatcher';
import fs from 'fs';
import gawk, { GawkArray } from 'gawk';
import path from 'path';
import PluginError from './plugin-error';
import PluginInfo from './plugin-info';
import Response, { AppcdError, codes } from 'appcd-response';
import snooplogg from 'snooplogg';

import { EventEmitter } from 'events';
import { expandPath } from 'appcd-path';
import { isDir, isFile } from 'appcd-fs';

const logger = snooplogg.config({ theme: 'detailed' })('appcd:plugin:manager');
const { highlight, note } = snooplogg.styles;

// curl -i -X POST -d "path=/Users/chris2" -H "Accept-Language: es-ES;q=0.9, fr-CH,fr;q=0.88, en;q=0.8, de;q=0.72, *;q=0.5" http://localhost:1732/appcd/plugin/register
// curl -i -X POST -d "path=/Users/chris2" http://localhost:1732/appcd/plugin/register

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
		super();

		/**
		 * A list of paths that contain plugin packages.
		 * @type {Array.<String>}
		 */
		this.paths = [];

		/**
		 * A list of all detected plugins.
		 * @type {GawkArray}
		 */
		this.plugins = new GawkArray;

		if (!opts || typeof opts !== 'object') {
			throw new TypeError('Expected options to be an object');
		}

		if (opts.paths) {
			if (!Array.isArray(opts.paths)) {
				throw new TypeError('Expected paths to be an array');
			}

			for (const dir of opts.paths) {
				if (dir) {
					this.paths.push(expandPath(dir));
				}
			}
		}

		/**
		 * The plugin manager dispatcher.
		 * @type {Dispatcher}
		 */
		this.dispatcher = new Dispatcher()
			.register('/register', ctx => {
				const pluginPath = ctx.payload.data.path;
				const plugin = new PluginInfo(pluginPath);
				try {
					this.register(plugin);
					ctx.response = new Response(codes.PLUGIN_REGISTERED);
				} catch (e) {
					logger.warn(e.message);
					ctx.response = new Response(e);
				}
			})
			.register('/unregister', ctx => {
				const pluginPath = ctx.payload.data.path;
				if (!pluginPath) {
					throw new PluginError(codes.PLUGIN_BAD_REQUEST);
				}
				this.unregister(pluginPath);
				ctx.response = new Response(codes.PLUGIN_UNREGISTERED);
			})
			.register('/status', ctx => {
				ctx.response = this.plugins;
			})
			.register('/start', ctx => {
				ctx.response = 'START!';
			})
			.register('/stop', ctx => {
				ctx.response = 'STOP!';
			});

		for (const dir of this.paths) {
			this.detect(dir);
		}

		// TODO: start watching paths to trigger redetect

		gawk.watch(this.plugins, (obj, src) => this.emit('change', obj, src));
	}

	/**
	 * Detects all plugins in the given directory.
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
				let plugin;

				try {
					plugin = new PluginInfo(dir);

					try {
						this.register(plugin);
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

	/**
	 * Registers a plugin and sends out notifications.
	 *
	 * @param {PluginInfo} plugin - The plugin info object.
	 * @access private
	 */
	register(plugin) {
		if (!(plugin instanceof PluginInfo)) {
			throw new TypeError('Expected a plugin info object');
		}

		logger.log('Registering plugin: %s', highlight(`${plugin.name}@${plugin.version}`));

		// check to make sure we don't insert the same plugin twice
		for (const p of this.plugins) {
			if (p.path === plugin.path) {
				throw new PluginError(codes.PLUGIN_ALREADY_REGISTERED);
			}
		}

		logger.log('Found plugin: %s', highlight(`${plugin.name}@${plugin.version}`), note(plugin.path));

		this.plugins.push(plugin);
	}

	/**
	 * Unregisters a plugin and sends out notifications.
	 *
	 * @param {PluginInfo|String} plugin - The plugin info object or plugin path.
	 * @access private
	 */
	unregister(plugin) {
		let pluginPath = plugin instanceof PluginInfo ? plugin.path : plugin;

		if (pluginPath && typeof pluginPath === 'string') {
			pluginPath = expandPath(pluginPath);

			for (let i = 0; i < this.plugins.length; i++) {
				if (this.plugins[i].path === pluginPath) {
					if (this.plugins[i].type === 'internal') {
						throw new PluginError('Cannot unregister internal plugins');
					}
					this.plugins[i].stop();
					this.plugins.splice(i--, 1);
					return;
				}
			}
		}

		throw new PluginError(codes.PLUGIN_NOT_REGISTERED);
	}
}
