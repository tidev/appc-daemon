import { codes } from 'appcd-response';

/**
 * A context that contains request information and is routed through the dispatcher.
 */
export default class DispatcherContext {
	/**
	 * A timestamp when this context was created which is generally right before a request is
	 * dispatched.
	 * @type {Number}
	 */
	startTime = Date.now();

	/**
	 * The response status.
	 * @type {Number}
	 */
	status = codes.OK;

	/**
	 * The number of milliseconds a request took.
	 * @type {Number}
	 */
	get time() {
		return Date.now() - this.startTime;
	}

	/**
	 * Mixes the context parameters into this instance.
	 *
	 * @param {Object} params - Various context-specific parameters.
	 */
	constructor(params) {
		Object.assign(this, params);
	}
}
