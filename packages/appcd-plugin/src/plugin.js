import ExternalPlugin from './external-plugin';
import fs from 'fs';
import gawk from 'gawk';
import InternalPlugin from './internal-plugin';
import path from 'path';
import PluginError from './plugin-error';
import semver from 'semver';
import snooplogg from 'snooplogg';
import types from './types';

import { EventEmitter } from 'events';
import { expandPath } from 'appcd-path';
import { isDir, isFile } from 'appcd-fs';

/*
wire up agent
- external only
- updates usage in plugin instance (in parent process)

deactivate after timeout

external plugin state

stream from parent to child

restart plugin on error?
reload external plugin
*/

const logger = snooplogg.config({ theme: 'detailed' })(process.connected ? 'appcd:plugin:host:plugin' : 'appcd:plugin');

/**
 * A regular expression that removes all invalid characters from the plugin's name so that it is
 * safe to use in a URL.
 * @type {RegExp}
 */
const urlSafeRegExp = /[^\w$\-_.+!*'(),]/g;

/**
 * Contains information about a plugin.
 */
export default class Plugin extends EventEmitter {
	/**
	 * Determines if the specified directory is a plugin and then loads it's meta data.
	 *
	 * @param {String} pluginPath - The path to the plugin.
	 * @access public
	 */
	constructor(pluginPath) {
		super();

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
			nodeVersion: undefined,
			error:       false
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

		if (this.type === 'external') {
			this.impl = new ExternalPlugin(this);
		} else {
			this.impl = new InternalPlugin(this);
		}

		return this;
	}

	/**
	 * Starts the plugin. This is called from the main process and not the plugin host process.
	 *
	 * @return {Promise}
	 * @access public
	 */
	start() {
		return this.impl.start();
	}

	/**
	 * Stops the plugin.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	stop() {
		return this.impl.stop();
	}

	/**
	 * Dispatches a request to the plugin's dispatcher.
	 *
	 * @param {Object} ctx - A dispatcher context.
	 * @param {Function} next - A function to continue to next dispatcher route.
	 * @returns {Promise}
	 * @access public
	 */
	dispatch(ctx, next) {
		return this.impl.dispatch(ctx, next);
	}

	/**
	 * Returns a string with this plugin's name and version.
	 *
	 * @returns {String}
	 * @access public
	 */
	toString() {
		return `${this.name}@${this.version}`;
	}
}
