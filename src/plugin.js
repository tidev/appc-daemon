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
	 * @param {Object} opts
	 * @param {String} opts.name
	 * @param {String} opts.path
	 * @param {Object} opts.cls
	 * @param {Object} opts.pkgJson
	 */
	constructor({ name, path, cls, pkgJson }) {
		this.name = name;
		this.path = path;
		this.pkgJson = typeof pkgJson === 'object' && pkgJson !== null ? pkgJson : {};

		this.service = new cls({
			logger: new Logger(name),
			router: this.router,
			dispatcher: this.dispatcher
		});

		appcd.logger.info('Loaded plugin ' + appcd.logger.colors.cyan(name) + (pkgJson.version ? ' v' + pkgJson.version : '') + ' ' + appcd.logger.colors.grey(path));
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
	 * @param {String} pluginDir
	 * @returns {Plugin}
	 * @access public
	 */
	static load(pluginDir) {
		const pkgJsonFile = path.join(pluginDir, 'package.json');
		let pkgJson = {};
		if (fs.existsSync(pkgJsonFile)) {
			pkgJson = JSON.parse(fs.readFileSync(pkgJsonFile));
		}

		const main = pkgJson && pkgJson.main || 'index.js';

		let file = main;
		if (!/\.js$/.test(file)) {
			file += '.js';
		}
		file = resolvePath(pluginDir, file);
		if (!fs.existsSync(file)) {
			throw new Error(`Unable to find main file: ${main}`);
		}

		const name = pkgJson.name || name;
		const module = require(file);
		const obj = module && module.__esModule ? module : { default: module };
		const cls = module.default;

		if (!cls || typeof cls !== 'function' || !(cls.prototype instanceof Service)) {
			throw new Error(`Plugin does not export a service`);
		}

		return new Plugin({
			name,
			path: pluginDir,
			cls,
			pkgJson
		});
	}
}
