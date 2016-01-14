/**
 * Base class to define a service.
 */
export default class Service {
	/**
	 * Initializes the service internals.
	 *
	 * @param {Object} opts
	 * @param {Logger} opts.logger
	 * @param {Router} opts.router
	 * @param {Dispatcher} opts.dispatcher
	 */
	constructor({ logger, router, dispatcher }) {
		this.logger   = logger;
		this.router   = router;
		this.register = dispatcher.register;
		this.request  = dispatcher.request;
	}
}
