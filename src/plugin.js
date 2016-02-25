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
	 * Initializes a plugin descriptor.
	 *
	 * @param {Object} opts - An object containing various options.
	 * @param {String} opts.name - The plugin name.
	 * @param {String} opts.path - The plugin path.
	 * @param {Object} opts.ServiceClass - The plugin's main exported service class.
	 * @param {Object} opts.pkgJson - The contents of the package.json.
	 * @param {Server} opts.server - The appcd server instance.
	 */
	constructor({ name, path, ServiceClass, pkgJson, appcdEmitter, appcdDispatcher, server }) {
		/**
		 * The plugin name.
		 * @type {String}
		 */
		this.name = this.name || name;

		/**
		 * The namespace to use for the plugin's routes.
		 * @type {String}
		 */
		this.namespace = this.namespace || name.replace(/^appcd-plugin-/, '');
		if (this.namespace === 'appcd') {
			throw new Error('Forbidden plugin name "appcd"');
		}

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
		 * The plugin's scoped logger.
		 * @type {Logger}
		 */
		this.logger = new Logger(this.namespace);

		/**
		 * The plugin's scoped dispatcher.
		 * @type {Router}
		 */
		this.dispatcher = new Dispatcher;
		appcdDispatcher.register('/' + this.namespace, this.dispatcher);

		/**
		 * The plugin's scoped koa router.
		 * @type {Router}
		 */
		this.router = new Router;
		server.webserver.router.use('/' + this.namespace, this.router.routes());

		/**
		 * The instance of the service.
		 * @type {Service}
		 */
		this.service = new ServiceClass({
			logger: this.logger,
			router: this.router,
			register: this.dispatcher.register,
			emit: (evt, ...args) => {
				return appcdEmitter.emit.apply(appcdEmitter, [this.namespace + ':' + evt, ...args]);
			},
			hook: (evt, ...args) => {
				return appcdEmitter.hook.apply(appcdEmitter, [this.namespace + ':' + evt, ...args]);
			}
		});

		appcd.logger.info('Loaded plugin %s%s %s', appcd.logger.highlight(name), (this.version ? ' v' + this.version : ''), appcd.logger.note(path));
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
	 * Returns the service's status to be included in server status requests.
	 *
	 * @returns {Object}
	 * @access public
	 */
	getStatus() {
		return this.service.getStatus();
	}
}
