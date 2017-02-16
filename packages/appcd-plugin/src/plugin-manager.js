import fs from 'fs';
import path from 'path';
import Plugin from './plugin';
import snooplogg from 'snooplogg';

import { expandPath } from 'appcd-path';
import { isDir, isFile } from 'appcd-fs';

const logger = snooplogg.config({ theme: 'detailed' })('appcd:plugin:manager');

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

		// TODO: start watching paths to trigger redetect

		for (const dir of this.paths) {
			this.detect(dir);
		}
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

		logger.log('Scanning for plugins: %s', dir);

		const versionRegExp = /^\d\.\d\.\d$/;

		for (const name of fs.readdirSync(dir)) {
			const subdir = path.join(dir, name);
			if (isFile(path.join(subdir, 'package.json'))) {
				// we have an NPM-style plugin
				try {
					this.registry.set(plugin.path, new Plugin(subdir));
				} catch (e) {}
			} else {
				// we have a versioned plugin
				for (const name of fs.readdirSync(subdir)) {
					if (versionRegExp.test(name) && isFile(path.join(subdir, name, 'package.json'))) {
						try {
							this.registry.set(plugin.path, new Plugin(path.join(subdir, name)));
						} catch (e) {}
					}
				}
			}
		}
	}
}
