import Dispatcher from './dispatcher';
import fs from 'fs';
import Logger from './logger';
import path from 'path';
import resolvePath from 'resolve-path';
import Router from 'koa-router';
import Service from './service';

/**
 * Wraps a plugin lifecycle.
 */
export default class Plugin {
	/**
	 * Scoped dispatcher.
	 * @type {Router}
	 */
	dispatcher = new Dispatcher;

	/**
	 * Scoped koa router.
	 * @type {Router}
	 */
	router = new Router;

	/**
	 * Initializes a plugin descriptor.
	 *
	 * @param {Object} opts - An object containing various options.
	 * @param {String} opts.name - The plugin name.
	 * @param {String} opts.path - The plugin path.
	 * @param {Object} opts.ServiceClass - The plugin's main exported service class.
	 * @param {Object} opts.pkgJson - The contents of the package.json.
	 */
	constructor({ name, path, ServiceClass, pkgJson }) {
		/**
		 * The plugin name.
		 * @type {String}
		 */
		this.name = name;

		/**
		 * The path to the plugin.
		 * @type {String}
		 */
		this.path = path;

		/**
		 * The contents of the package.json.
		 * @type {Object}
		 */
		this.pkgJson = pkgJson;

		/**
		 * The plugin version.
		 * @type {String}
		 */
		this.version = pkgJson.version || null;

		/**
		 * The instance of the service.
		 * @type {Service}
		 */
		this.service = new ServiceClass({
			logger: new Logger(name),
			router: this.router,
			dispatcher: this.dispatcher
		});

		appcd.logger.info('Loaded plugin %s%s %s', appcd.logger.colors.cyan(name), (this.version ? ' v' + this.version : ''), appcd.logger.colors.grey(path));
	}

	/**
	 * Calls the service's init function.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async init() {
		if (typeof this.service.init === 'function') {
			await this.service.init();
		}
	}

	/**
	 * Calls the service's shutdown function.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async shutdown() {
		if (typeof this.service.shutdown === 'function') {
			await this.service.shutdown();
		}
	}

	/**
	 * Loads all plugins in the specified directory.
	 *
	 * @param {String} pluginPath - The path to a plugin.
	 * @returns {Plugin} Plugin instance or null if not a plugin.
	 * @access public
	 */
	static load(pluginPath) {
		if (!fs.existsSync(pluginPath)) {
			return null;
		}

		const pkgJsonFile = path.join(pluginPath, 'package.json');
		if (!fs.existsSync(pkgJsonFile)) {
			return null;
		}

		let pkgJson = JSON.parse(fs.readFileSync(pkgJsonFile));
		if (!pkgJson || typeof pkgJson !== 'object') {
			pkgJson = {};
		}

		const main = pkgJson.main || 'index.js';

		let file = main;
		if (!/\.js$/.test(file)) {
			file += '.js';
		}
		file = resolvePath(pluginPath, file);
		if (!fs.existsSync(file)) {
			throw new Error(`Unable to find main file: ${main}`);
		}

		const module = require(file);
		const obj = module && module.__esModule ? module : { default: module };
		const ServiceClass = module.default;

		if (!ServiceClass || typeof ServiceClass !== 'function' || !(ServiceClass.prototype instanceof Service)) {
			throw new Error(`Plugin does not export a service`);
		}

		return new Plugin({
			name: pkgJson.name || path.basename(pluginPath),
			path: pluginPath,
			ServiceClass,
			pkgJson
		});
	}
}
