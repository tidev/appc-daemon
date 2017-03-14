import fs from 'fs';
import gawk from 'gawk';
import path from 'path';
import PluginInfo from './plugin-info';
import snooplogg from 'snooplogg';

import { EventEmitter } from 'events';
import { expandPath } from 'appcd-path';
import { isDir, isFile } from 'appcd-fs';

const logger = snooplogg.config({ theme: 'detailed' })('appcd:plugin:manager');
const { highlight, note } = snooplogg.styles;

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
		 * A registry of all detected plugins.
		 * @type {Object}
		 */
		this.registry = {};

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

		for (const dir of this.paths) {
			this.detect(dir);
		}

		// TODO: start watching paths to trigger redetect
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
					const plugin = new PluginInfo(dir);
					const key = `${plugin.name}@${plugin.version}`;
					if (this.registry[key]) {
						logger.warn('Already found plugin: %s %s', highlight(key), note(plugin.path));
					} else {
						logger.log('Found plugin: %s', highlight(key), note(plugin.path));
						this.register(plugin);
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

		if (this.registry[plugin.id]) {
			throw new Error(`Plugin already registered: ${plugin.id}`);
		}

		this.registry[plugin.id] = plugin;
		this.emit('register', plugin);
		gawk.watch(plugin, () => this.emit('change', plugin));
	}

	/**
	 * Unregisters a plugin by id and sends out notifications.
	 *
	 * @param {String} id - The plugin's identifier.
	 * @access private
	 */
	unregister(id) {
		const plugin = this.registry[id];
		if (plugin) {
			gawk.unwatch(plugin);
			delete this.registry[id];
			this.emit('unregister', plugin);
		}
	}
}
