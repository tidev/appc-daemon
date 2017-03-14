import fs from 'fs';
import path from 'path';
import PluginInfo from './plugin-info';
import snooplogg from 'snooplogg';

import { expandPath } from 'appcd-path';
import { isDir, isFile } from 'appcd-fs';

const logger = snooplogg.config({ theme: 'detailed' })('appcd:plugin:manager');
const { highlight } = snooplogg.styles;

export default class PluginManager {
	/**
	 * Creates a plugin manager instance.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {Array.<String>} [opts.paths] - A list of paths to scan for plugins.
	 * @access public
	 */
	constructor(opts = {}) {
		/**
		 * A list of paths that contain plugin packages.
		 * @type {Array.<String>}
		 */
		this.paths = [];

		/**
		 * A registry of all detected plugins.
		 * @type {Map.<String,Plugin>}
		 */
		this.registry = new Map;

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
					logger.log('Found plugin: %s', highlight(`${plugin.name}@${plugin.version}`));
					this.registry.set(plugin.path, plugin);
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
}
