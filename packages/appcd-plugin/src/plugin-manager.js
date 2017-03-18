import Dispatcher, { ServiceDispatcher } from 'appcd-dispatcher';
import fs from 'fs';
import gawk, { GawkArray } from 'gawk';
import path from 'path';
import PluginInfo from './plugin-info';
import snooplogg from 'snooplogg';

import { createErrorClass } from 'appcd-error';
import { EventEmitter } from 'events';
import { expandPath } from 'appcd-path';
import { isDir, isFile } from 'appcd-fs';

const logger = snooplogg.config({ theme: 'detailed' })('appcd:plugin:manager');
const { highlight, note } = snooplogg.styles;

const PluginError = createErrorClass('PluginError');

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

				this.register(new PluginInfo(pluginPath));

				console.log(ctx);
				ctx.response = 'REGISTER!';
			})
			.register('/unregister', ctx => {
				ctx.response = 'UNREGISTER!';
			})
			.register('/status', ctx => {
				ctx.response = this.plugins;
			})
			.register('/load', ctx => {
				ctx.response = 'LOAD!';
			})
			.register('/unload', ctx => {
				ctx.response = 'UNLOAD!';
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

		const tryPlugin = dir => {
			if (isFile(path.join(dir, 'package.json'))) {
				// we have an NPM-style plugin
				try {
					this.register(new PluginInfo(dir));
					return true;
				} catch (e) {
					logger.warn('Invalid plugin: %s', highlight(dir));
					logger.warn(e.message);
				}
			}
		};

		for (const name of fs.readdirSync(dir)) {
			const subdir = path.join(dir, name);
			if (isDir(subdir) && !tryPlugin(subdir)) {
				// we have a versioned plugin
				for (const name of fs.readdirSync(subdir)) {
					if (versionRegExp.test(name)) {
						tryPlugin(path.join(subdir, name));
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

		// check to make sure we don't insert the same plugin twice
		for (const p of this.plugins) {
			if (p.path === plugin.path) {
				logger.log('Plugin already registered, skipping: %s', highlight(`${plugin.name}@${plugin.version}`), note(plugin.path));
				return;
			}
		}

		logger.log('Found plugin: %s', highlight(`${plugin.name}@${plugin.version}`), note(plugin.path));

		this.plugins.push(plugin);
	}

	/**
	 * Unregisters a plugin and sends out notifications.
	 *
	 * @param {PluginInfo} plugin - The plugin info object.
	 * @access private
	 */
	unregister(plugin) {
		if (plugin) {
			for (let i = 0; i < this.plugins.length; i++) {
				if (this.plugins[i] === plugin) {
					this.plugins.splice(i--, 1);
				}
			}
		}
	}
}
