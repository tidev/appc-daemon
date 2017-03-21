import Message from './message';

/**
 * A Appc Daemon response. This class can be extended or used as is.
 */
export class Response {
	/**
	 * Creates an response instance.
	 *
	 * @param {String|Number|Object} msg - The code or message.
	 */
	constructor(...args) {
		Object.defineProperty(this, 'msg', {
			value: new Message('%s', ...args)
		});
	}

	get status() {
		return this.msg.status;
	}

	toString(locale) {
		return this.msg.toString(locale);
	}
}
