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
	 * @param {Function} opts.register - The plugin's scoped dispatcher register function.
	 * @param {Function} opts.emit - The plugin's scoped event emitter.
	 * @param {Function} opts.hook - The plugin's scoped hook emitter.
	 */
	constructor({ logger, router, register, emit, hook }) {
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
		 * Emits an event.
		 *
		 * @param {String} evt - The event name.
		 * @param {*} [...] - One or more arguments.
		 * @returns {Promise}
		 * @access public
		 */
		this.emit = emit;

		/**
		 * Hooks a function.
		 *
		 * @param {String} evt - The event name.
		 * @param {Object} [ctx] - The context to bind `fn`.
		 * @param {Function} fn - The function to hook.
		 * @returns {Promise}
		 * @access public
		 */
		this.hook = hook;
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
