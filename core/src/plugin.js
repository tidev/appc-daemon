import Dispatcher from './dispatcher';
import Logger from './logger';
import Router from './router';
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
	 * @param {String} opts.mainFile - The path to the plugin's main file.
	 * @param {Object} opts.pkgJson - The contents of the package.json.
	 * @param {Server} opts.server - The appcd server instance.
	 */
	constructor({ name, path, mainFile, pkgJson, server }) {
		/**
		 * The plugin name.
		 * @type {String}
		 */
		this.name = this.name || name;

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
		 * The plugin's scoped dispatcher.
		 * @type {Router}
		 */
		this.dispatcher = new Dispatcher;

		/**
		 * The plugin's scoped koa router.
		 * @type {Router}
		 */
		this.router = new Router;

		// load the plugin's main file
		const module = require(mainFile);
		const ServiceClass = module && module.__esModule ? module.default : module;

		// double check that this plugin exports a service
		// check-plugin.js should have already done this for us, but better safe than sorry
		if (!ServiceClass || typeof ServiceClass !== 'function' || !(ServiceClass.prototype instanceof Service)) {
			throw new Error('Plugin does not export a service');
		}

		/**
		 * The namespace to use for the plugin's routes.
		 * @type {String}
		 */
		this.namespace = ServiceClass.namespace || name.replace(/^appcd-plugin-/, '');
		if (this.namespace === 'appcd') {
			throw new Error('Forbidden plugin name "appcd"');
		}

		/**
		 * The plugin's scoped logger.
		 * @type {Logger}
		 */
		this.logger = new Logger(this.namespace);

		/**
		 * The instance of the service.
		 * @type {Service}
		 */
		this.service = new ServiceClass({
			logger: this.logger,
			router: this.router,
			register: this.dispatcher.register,
			emit: (evt, ...args) => {
				if (evt.indexOf(':') === -1) {
					evt = this.namespace + ':' + evt;
				}
				return server.emit.apply(server, [evt, ...args]);
			},
			hook: (evt, ...args) => {
				if (evt.indexOf(':') === -1) {
					evt = this.namespace + ':' + evt;
				}
				return server.hook.apply(server, [evt, ...args]);
			}
		});
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
