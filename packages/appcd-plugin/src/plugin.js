import fs from 'fs';
import gawk from 'gawk';
import path from 'path';
import PluginContainer from './plugin-container';
import PluginError from './plugin-error';
import semver from 'semver';
import snooplogg from 'snooplogg';
import types from './types';

import { codes } from 'appcd-response';
import { expandPath } from 'appcd-path';
import { isDir, isFile } from 'appcd-fs';
import { ServiceDispatcher } from 'appcd-dispatcher';

export const state = {
	STOPPED:  'stopped',
	STARTING: 'starting',
	STARTED:  'started',
	STOPPING: 'stopping'
};

const { log } = snooplogg.config({ theme: 'detailed' })('appcd:plugin:plugin');
const { highlight } = snooplogg.styles;

const urlSafeRegExp = /[^\w$\-_.+!*'(),]/g;

/**
 * Contains information about a plugin.
 */
export default class Plugin {
	/**
	 * Determines if the specified directory is a plugin and then loads it's meta data.
	 *
	 * @param {String} pluginPath - The path to the plugin.
	 * @access public
	 */
	constructor(pluginPath) {
		/**
		 * Internal plugin information storage. Since a `Plugin` object cannot be gawked, we store
		 * just the properties that can be gawked in a private object, then define setters to make
		 * accessing the properties transparent.
		 * @type {GawkObject}
		 */
		this.info = gawk({
			path:        undefined,
			name:        undefined,
			version:     undefined,
			main:        undefined,
			type:        'external',
			pid:         undefined,
			nodeVersion: undefined,
			error:       false,
			state:       'stopped'
		});

		return new Proxy(this, {
			get(target, name) {
				if (target.info.hasOwnProperty(name)) {
					return target.info[name];
				} else {
					return target[name];
				}
			},

			set(target, name, value) {
				if (name === 'info') {
					throw new Error('The "info" property is readonly');
				}
				if (target.info.hasOwnProperty(name)) {
					target.info[name] = value;
				} else {
					target[name] = value;
				}
				return true;
			}
		}).init(pluginPath);
	}

	/**
	 * Validates and load's the plugins information.
	 *
	 * @param {String} pluginPath - The Path to the plugin.
	 * @returns {Plugin}
	 * @access private
	 */
	init(pluginPath) {
		if (!pluginPath || typeof pluginPath !== 'string') {
			throw new PluginError('Expected plugin path to be a non-empty string');
		}
		pluginPath = expandPath(pluginPath);
		if (!isDir(pluginPath)) {
			throw new PluginError('Plugin path does not exist: %s', pluginPath);
		}
		this.path = pluginPath;

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

		// validate and set the package name
		if (pkgJson.name) {
			if (typeof pkgJson.name !== 'string') {
				throw new PluginError('Invalid "name" property in %s', pkgJsonFile);
			}
			this.name = pkgJson.name.replace(urlSafeRegExp, '');
		}

		// validate and set the version
		if (!pkgJson.version || typeof pkgJson.version !== 'string') {
			throw new PluginError('Missing "version" property in %s', pkgJsonFile);
		}
		const version = semver.valid(pkgJson.version);
		if (!version) {
			throw new PluginError('Invalid version "%s" in %s', pkgJson.version, pkgJsonFile);
		}
		this.version = version;

		// find the main file
		let main = expandPath(pluginPath, pkgJson.main || 'index.js');
		if (isDir(main)) {
			main = path.join(main, 'index.js');
		}
		if (!/\.js$/.test(main)) {
			main += '.js';
		}
		if (!isFile(main)) {
			throw new PluginError('Unable to find main file "%s"', pkgJson.main || 'index.js');
		}
		this.main = main;

		const appcdPlugin = pkgJson['appcd-plugin'];
		if (appcdPlugin) {
			if (typeof appcdPlugin !== 'object') {
				throw new PluginError('Expected "appcd-plugin" section to be an object in %s', pkgJsonFile);
			}

			if (appcdPlugin.name) {
				if (typeof appcdPlugin.name !== 'string') {
					throw new PluginError('Invalid "name" property in the "appcd-plugin" section of %s', pkgJsonFile);
				}
				this.name = appcdPlugin.name.replace(urlSafeRegExp, '');
			}

			if (appcdPlugin.type) {
				if (typeof appcdPlugin.type !== 'string' || types.indexOf(appcdPlugin.type) === -1) {
					throw new PluginError('Invalid type "%s" in "appcd-plugin" section of %s', appcdPlugin.type, pkgJsonFile);
				}
				this.type = appcdPlugin.type;
			}
		}

		// validate the name
		if (!this.name) {
			throw new PluginError('Invalid "name" property in the "appcd-plugin" section of %s', pkgJsonFile);
		}
		if (this.name === 'appcd') {
			throw new PluginError('Plugin forbidden from using the name "%s"', 'appcd');
		}

		this.nodeVersion = pkgJson.engines && pkgJson.engines.node || process.version.replace(/^v/, '');

		// error checking
		if (this.type === 'internal' && this.nodeVersion && !semver.satisfies(process.version, this.nodeVersion)) {
 			this.error = `Internal plugin requires Node.js ${this.nodeVersion}, but currently running ${process.version}`;
		}

		/**
		 * A list of directories to be watched for source changes.
		 * @type {Set}
		 */
		this.directories = new Set()
			.add(pluginPath)
			.add(path.dirname(main));
		if (typeof pkgJson.directories === 'object') {
			for (const type of [ 'lib', 'src' ]) {
				const dir = pkgJson.directories[type];
				if (dir && typeof dir === 'string') {
					this.directories.add(path.isAbsolute(dir) ? dir : path.resolve(pluginPath, dir));
				}
			}
		}

		/**
		 * The dispatcher that interfaces with the plugin service.
		 * @type {ServiceDispatcher}
		 */
		this.dispatcher = new ServiceDispatcher(
			// new RegExp(`^\/${this.namespace.replace(/\./g, '\\.')}\/v?${version.replace(/\./g, '\\.')}(?:(?:\/.*)|$)`),
			this
		);

		this.container = null;

		return this;
	}

	start() {
		if (this.state !== state.STOPPED) {
			throw new Error(`Cannot start plugin when state is "${this.state}"`);
		}

		if (this.type === 'external') {
			// spawn the plugin host
		} else {
			// internal or hook
			this.container = new PluginContainer({
				path: this.path
			});
		}
	}

	stop() {
	}

	/**
	 * Responds to "call" service requests.
	 *
	 * @param {Object} ctx - A dispatcher request context.
	 * @access private
	 */
	onCall(ctx) {
		log(ctx.path);
		ctx.response = JSON.stringify(this._info);
	}

	/**
	 * Responds to "subscribe" service requests.
	 *
	 * @param {Object} ctx - A dispatcher request context.
	 * @param {Function} publish - A function used to publish data to a dispatcher client.
	 * @access private
	 */
	onSubscribe(ctx, publish) {
		//
	}

	/**
	 * Responds to "unsubscribe" service requests.
	 *
	 * @param {Object} ctx - A dispatcher request context.
	 * @param {Function} publish - The function used to publish data to a dispatcher client. This is
	 * the same publish function as the one passed to `onSubscribe()`.
	 * @access private
	 */
	onUnsubscribe(ctx, publish) {
		//
	}

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
