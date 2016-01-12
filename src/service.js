/**
 * Base class to define a service.
 */
export default class Service {
	constructor(opts) {
		this.logger = opts.logger;
		this.router = opts.router;
		this.register = opts.dispatcher.register;
		this.request = opts.dispatcher.request;
	}
}
