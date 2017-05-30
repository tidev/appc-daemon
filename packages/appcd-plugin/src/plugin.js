import Dispatcher from 'appcd-dispatcher';
import fs from 'fs';
import path from 'path';
import PluginError from './plugin-error';
import semver from 'semver';
import snooplogg from 'snooplogg';

import { codes } from 'appcd-response';
import { expandPath } from 'appcd-path';
import { inherits } from 'appcd-util';
import { isDir, isFile } from 'appcd-fs';

const log = snooplogg.config({ theme: 'detailed' })('appcd:plugin:plugin').log;
const { highlight } = snooplogg.styles;

/**
 * Contains information about a plugin.
 */
export default class Plugin {
	/**
	 * Determines if the specified directory is a plugin and then loads it's meta data.
	 *
	 * @param {String} pluginPath - The path to the plugin.
	 */
	constructor(pluginPath) {
		if (!pluginPath || typeof pluginPath !== 'string') {
			throw new PluginError('Expected plugin path to be a non-empty string');
		}

		pluginPath = expandPath(pluginPath);

		if (!isDir(pluginPath)) {
			throw new PluginError('Plugin path does not exist: %s', pluginPath);
		}

		const pkgJsonFile = path.join(pluginPath, 'package.json');
		if (!isFile(pkgJsonFile)) {
			throw new PluginError('Plugin path does not contain a package.json: %s', pluginPath);
		}

		let pkgJson;
		try {
			pkgJson = JSON.parse(fs.readFileSync(pkgJsonFile, 'utf8'));
		} catch (e) {
			throw new PluginError('Error parsing %s: %s', pkgJsonFile, e.message);
		}

		// validate that the package.json has a name and a version
		if (!pkgJson.name || typeof pkgJson.name !== 'string') {
			throw new PluginError('Missing "name" property in %s', pkgJsonFile);
		}
		if (!pkgJson.version || typeof pkgJson.version !== 'string') {
			throw new PluginError('Missing "version" property in %s', pkgJsonFile);
		}
		if (!semver.valid(pkgJson.version)) {
			throw new PluginError('Invalid version "%s" in %s', pkgJson.version, pkgJsonFile);
		}

		// find the main file
		let main = expandPath(pluginPath, pkgJson.main || 'index.js');
		if (!/\.js$/.test(main)) {
			main += '.js';
		}
		if (!isFile(main)) {
			throw new PluginError('Unable to find main file "%s"', pkgJson.main || 'index.js');
		}

		const appcdPlugin = pkgJson['appcd-plugin'];
		if (!appcdPlugin || typeof appcdPlugin !== 'object') {
			throw new PluginError('Missing "appcd-plugin" section in %s', pkgJsonFile);
		}

		if (!appcdPlugin.name || typeof appcdPlugin.name !== 'string') {
			throw new PluginError('Missing "name" property in the "appcd-plugin" section of %s', pkgJsonFile);
		}
		if (appcdPlugin.name === 'appcd') {
			throw new PluginError('Plugin forbidden from using the name "%s"', 'appcd');
		}
		if (typeof appcdPlugin.type === 'string' && !/^(?:in|ex)ternal$/.test(appcdPlugin.type)) {
			throw new PluginError('Invalid type "%s" in "appcd-plugin" section of %s', appcdPlugin.type, pkgJsonFile);
		}

		/**
		 * The plugin path.
		 * @type {String}
		 */
		this.path = pluginPath;

		/**
		 * The plugin name.
		 * @type {String}
		 */
		this.name = pkgJson.name;

		/**
		 * The plugin version.
		 * @type {String}
		 */
		this.version = pkgJson.version;

		/**
		 * The path to the plugin's main file.
		 * @type {String}
		 */
		this.main = main;

		/**
		 * The dispatcher namespace.
		 * @type {String}
		 */
		this.namespace = appcdPlugin.name;

		/**
		 * The plugin type. Must be either `internal` or `external`.
		 * @type {String}
		 */
		this.type = appcdPlugin.type === 'internal' ? 'internal' : 'external';

		/**
		 * The process id of the plugin host child process when the `type` is set to `external`. If
		 * the value is `null`, then the `type` is `internal` or the child process is not running.
		 * @type {?Number}
		 */
		this.pid = null;

		// /**
		//  * The reference to the primary exported module of internal plugins.
		//  * @type {Class|Function|Object}
		//  */
		// this.module = null;
		//
		// /**
		//  * The reference to the instance of an internal plugin's module.
		//  * @type {Plugin|Object}
		//  */
		// this.instance = null;

		/**
		 * A string containing an error with this plugin or false if the plugin is valid.
		 * @type {String|Boolean}
		 */
		this.error = false;

		/**
		 * The plugin's Node.js version.
		 * @type {String}
		 */
		this.nodeVersion = pkgJson.engines && pkgJson.engines.node || process.version.replace(/^v/, '');

		// error checking
		if (this.type === 'internal' && this.nodeVersion && !semver.satisfies(process.version, this.nodeVersion)) {
 			this.error = `Internal plugin requires Node.js ${this.nodeVersion}, but currently running ${process.version}`;
		}
	}

	// /**
	//  * Determines if a plugin is running.
	//  *
	//  * @type {Boolean}
	//  * @access public
	//  */
	// get active() {
	// 	return !!(this.type === 'internal' ? (this.module || this.instance) : this.pid);
	// }

	// /**
	//  * Loads a plugin.
	//  *
	//  * @returns {Promise}
	//  * @access public
	//  */
	// async load() {
	// 	if (this.type === 'internal') {
	// 		if (this.module) {
	// 			throw new PluginError(codes.PLUGIN_ALREADY_STARTED);
	// 		}
	//
	// 		this.module = require(this.mainFile);
	//
	// 		if (!this.module || (typeof this.module !== 'object' && typeof this.module !== 'function')) {
	// 			this.error = 'Export not a plugin class or object';
	// 			throw new PluginError(codes.PLUGIN_BAD_REQUEST);
	// 		}
	//
	// 		if (typeof this.module === 'function') {
	// 			this.instance = new (this.module)();
	// 		} else {
	// 			this.instance = this.module;
	// 		}
	//
	// 		if (typeof this.instance.start === 'function') {
	// 			await this.instance.start();
	// 		}
	//
	// 		return;
	// 	}
	//
	// 	// TODO: spawn plugin host
	// }
	//
	// /**
	//  * Unloads an `external` plugin.
	//  *
	//  * @returns {Promise}
	//  * @access public
	//  */
	// async unload() {
	// 	if (this.type === 'internal' && this.instance && typeof this.instance.stop === 'function') {
	// 		await this.instance.unload();
	// 		// TODO: freeze cache
	// 	} else if (this.type === 'external' && this.pid) {
	// 		// return new Promise((resolve, reject) => {
	// 		// 	process.kill(this.pid, 'SIGTERM');
	// 		//
	// 		// 	// wait 1 second before killing the plugin host
	// 		// 	setTimeout(() => {
	// 		// 		if (this.pid) {
	// 		// 			process.kill(this.pid, 'SIGKILL');
	// 		// 		} else {
	// 		// 			resolve();
	// 		// 		}
	// 		// 	}, 1000);
	// 		// });
	// 	}
	// }
}
