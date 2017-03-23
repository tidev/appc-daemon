import fs from 'fs';
import path from 'path';
import PluginError from './plugin-error';
import semver from 'semver';
import snooplogg from 'snooplogg';

import { codes } from 'appcd-response';
import { expandPath } from 'appcd-path';
import { GawkObject } from 'gawk';
import { inherits } from 'appcd-util';
import { isDir, isFile } from 'appcd-fs';

const logger = snooplogg.config({ theme: 'detailed' })('appcd:plugin:plugin-info');
const { highlight } = snooplogg.styles;

/**
 * Contains information about a plugin.
 */
export default class PluginInfo extends GawkObject {
	/**
	 * Determines if the specified directory is a plugin and then loads it's meta data.
	 *
	 * @param {String} dir - The path to the plugin.
	 */
	constructor(dir) {
		dir = expandPath(dir);

		if (!isDir(dir)) {
			throw new PluginError('Plugin directory does not exist: %s', dir);
		}

		const pkgJsonFile = path.join(dir, 'package.json');
		if (!isFile(pkgJsonFile)) {
			throw new PluginError('Plugin directory does not contain a package.json: %s', dir);
		}

		let pkgJson;
		try {
			pkgJson = JSON.parse(fs.readFileSync(pkgJsonFile, 'utf8'));
		} catch (e) {
			throw new PluginError('Error reading plugin package.json file (%s): %s', pkgJsonFile, e.message);
		}

		// make sure package.json has a name
		if (!pkgJson.name) {
			throw new PluginError('Plugin package.json missing "name" property: %s', dir);
		}

		if (pkgJson.name === 'appcd') {
			throw new PluginError('Forbidden plugin name: %s', 'appcd');
		}

		super();

		/**
		 * The plugin name.
		 * @type {String}
		 */
		this.name = pkgJson.name;

		/**
		 * The plugin version.
		 * @type {String}
		 */
		this.version = pkgJson.version || null;

		/**
		 * The plugin path.
		 * @type {String}
		 */
		this.path = dir;

		/**
		 * Indicates if the plugin is loaded.
		 * @type {Boolean}
		 */
		this.loaded = false;

		/**
		 * The plugin type. Must be either `internal` or `external`.
		 * @type {String}
		 */
		this.type = pkgJson.appcd && pkgJson.appcd.type === 'internal' ? 'internal' : 'external';

		/**
		 * The plugin's Node.js version.
		 * @type {String}
		 */
		this.nodeVersion = pkgJson.engines && pkgJson.engines.node;
 		if (!this.nodeVersion) {
 			this.nodeVersion = process.version.replace(/^v/, '');
 		} else if (this.type === 'internal' && !semver.satisfies(process.version, this.nodeVersion)) {
 			this.error = `Internal plugin requires Node.js ${this.nodeVersion}, but core is currently running ${process.version}`;
 			return;
 		}

		/**
		 * The process id of the plugin host child process when the `type` is set to `external`. If
		 * the value is `null`, then the `type` is `internal` or the child process is not running.
		 * @type {?Number}
		 */
		this.pid = null;

		/**
		 * The reference to the primary exported module of internal plugins.
		 * @type {Class|Function|Object}
		 */
		this.module = null;

		/**
		 * The reference to the instance of an internal plugin's module.
		 * @type {Plugin|Object}
		 */
		this.instance = null;

		/**
		 * A string containing an error with this plugin or false if the plugin is valid.
		 * @type {String|Boolean}
		 */
		this.error = false;

		/**
		 * Tracks the number of times an external plugin has been restarted due to the plugin host
		 * exited unexpectedly or has become unresponsive.
		 * @type {Number}
		 */
		this.restarts = 0;

		// find the main file
		const main = pkgJson.main || 'index.js';
		let mainFile = main;
		if (!/\.js$/.test(mainFile)) {
			mainFile += '.js';
		}
		mainFile = expandPath(dir, mainFile);
		if (!isFile(mainFile)) {
			this.error = `Unable to find main file: ${main}`;
		}
	}

	/**
	 * Loads a plugin.
	 *
	 * @access public
	 */
	async start() {
		if (this.type === 'internal') {
			if (this.module) {
				throw new PluginError(codes.PLUGIN_ALREADY_STARTED);
			}

			this.module = require(this.mainFile);

			if (!this.module || (typeof this.module !== 'object' && typeof this.module !== 'function')) {
				this.error = 'Export not a plugin class or object';
				throw new PluginError(codes.PLUGIN_BAD_REQUEST);
			}

			if (typeof this.module === 'function') {
				this.instance = new (this.module)();
			} else {
				this.instance = this.module;
			}

			if (typeof this.instance.start === 'function') {
				await this.instance.start();
			}

			return;
		}

		// TODO: spawn plugin host
	}

	/**
	 * Unloads an `external` plugin.
	 *
	 * @access public
	 */
	stop() {
		if (this.type === 'internal') {
			throw new PluginError('Cannot stop internal plugins');
		}

		// TODO: kill the child process
	}
}
