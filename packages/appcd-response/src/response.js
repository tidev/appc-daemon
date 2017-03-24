import Message from './message';

/**
 * A Appc Daemon response. This class can be extended or used as is.
 */
export default class Response {
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

	/**
	 * Returns the message code. The value can be `null`.
	 *
	 * @type {String?}
	 * @access public
	 */
	get code() {
		return this.msg.code;
	}

	/**
	 * Returns the message number. The value can be `null`.
	 *
	 * @type {Number?}
	 * @access public
	 */
	get status() {
		return this.msg.status;
	}

	/**
	 * Formats the response for the given locale.
	 *
	 * @param {String|Array.<String>} [locales] - A list of preferred locales to format the message.
	 * @returns {String}
	 * @access public
	 */
	toString(locale) {
		return this.msg.toString(locale);
	}
}
