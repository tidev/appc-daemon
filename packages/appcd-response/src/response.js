import Message from './message';

/**
 * A Appc Daemon response. This class can be extended or used as is.
 */
export default class Response extends Message {
	/**
	 * Creates an response instance.
	 *
	 * @param {String|Number|Object} msg - The code or message.
	 */
	constructor(...args) {
		super(...args);
	}
}
