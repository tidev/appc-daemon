/**
 * Base class to define a service.
 */
export default class Service {
	/**
	 * Initializes the service internals.
	 *
	 * @param {Object} opts - An object containing various options.
	 * @param {Logger} opts.logger - The plugin's scoped logger.
	 * @param {Router} opts.router - The plugin's scoped koa router.
	 * @param {Dispatcher} opts.dispatcher - The plugin's scoped dispatcher.
	 */
	constructor({ logger, router, register, emit }) {
		/**
		 * The plugin's scoped logger.
		 * @type {Logger}
		 */
		this.logger = logger;

		/**
		 * The plugin's scoped koa router.
		 * @type {Router}
		 */
		this.router = router;

		/**
		 * Registers a handler to a path.
		 *
		 * @param {String|RegExp|Array<String>|Array<RegExp>} path
		 * @param {Function|Dispatcher} handler
		 * @returns {Dispatcher}
		 * @access public
		 */
		this.register = register;

		/**
		 * ???????????????????
		 *
		 * @param {String} evt
		 * @param {Object} [data={}]
		 * @returns {EventEmitter}
		 * @access public
		 */
		this.emit = emit;
	}

	/**
	 * Stub function for the service initialization.
	 */
	init() {
	}

	/**
	 * Stub function for the service shutdown.
	 */
	shutdown() {
	}

	/**
	 * Returns the service's status to be included in server status requests.
	 *
	 * @returns {Object}
	 * @access public
	 */
	getStatus() {
		return {};
	}
}
