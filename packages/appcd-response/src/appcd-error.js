import Message from './message';

import { codes } from './codes';

/**
 * A Appc Daemon error. This class can be extended or used as is.
 */
export default class AppcdError extends Error {
	/**
	 * Creates an error instance.
	 *
	 * @param {String|Number|AppcdError|Error|Object} msg - The code, message, or error.
	 */
	constructor(...args) {
		super();

		Object.defineProperties(this, {
			name: { writable: true, value: 'AppcdError' },
			msg: { value: new Message('Unknown Error: %s', ...args) }
		});

		Error.captureStackTrace(this, this.constructor);
	}

	/**
	 * Returns the 'en' locale specific message.
	 * @type {String}
	 * @access public
	 */
	get message() {
		return this.msg.toString(null, 'Unknown Error');
	}

	/**
	 * The error status.
	 * @type {Number}
	 */
	get status() {
		return this.msg.status;
	}

	/**
	 * The error code.
	 * @type {String}
	 */
	get code() {
		return this.msg.code;
	}

	/**
	 * Formats and returns the error message.
	 *
	 * @param {String} [locale] - The locale used to translate the message.
	 * @returns {String}
	 * @access public
	 */
	toString(locale) {
		const code = this.msg.code ? ` (code ${this.msg.code})` : '';
		return `${this.name}: ${this.msg.toString(locale, 'Unknown Error')}${code}`;
	}
}

AppcdError.codes = codes;

/**
 * Helper function to create one-off custom error objects. It's equivalent to creating a custom
 * error class that extends `AppcdError`.
 *
 * @param {String} name - The name of the custom error.
 * @param {Object} [opts] - Additional options.
 * @param {Number} [opts.defaultStatus] - A default status if the error doesn't explicitly have one.
 * @param {Number} [opts.defaultCode] - A default code if the error doesn't explicitly have one.
 * @returns {Function}
 */
export function createErrorClass(name, opts = {}) {
	if (!name || typeof name !== 'string') {
		throw new TypeError('Expected custom error name to be a non-empty string');
	}

	if (opts) {
		if (typeof opts !== 'object') {
			throw new TypeError('Expected options to be an object');
		}

		if (opts.hasOwnProperty('defaultStatus') && typeof opts.defaultStatus !== 'number') {
			throw new TypeError('Expected default status to be a number');
		}

		if (opts.hasOwnProperty('defaultCode') && typeof opts.defaultCode !== 'number' && typeof opts.defaultCode !== 'string') {
			throw new TypeError('Expected default code to be a string or number');
		}
	}

	class CustomError extends AppcdError {
		constructor(...args) {
			super(...args);
			Object.defineProperty(this, 'name', { value: name });
			if (this.msg.status === null && opts.defaultStatus) {
				this.msg.status = opts.defaultStatus;
			}
			if (this.msg.code === null && opts.defaultCode) {
				this.msg.code = String(opts.defaultCode);
			}
		}
	}

	Object.defineProperty(CustomError, 'name', {
		enumerable: true,
		value: name
	});

	CustomError.codes = codes;

	return CustomError;
}
