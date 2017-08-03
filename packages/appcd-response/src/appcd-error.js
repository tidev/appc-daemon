import Message from './message';

import { codes } from './codes';

/**
 * A Appc Daemon error. This class can be extended or used as is.
 */
export default class AppcdError extends Error {
	/**
	 * Creates an error instance.
	 *
	 * @param {...*} args - The code, message, or error.
	 */
	constructor(...args) {
		super();

		// must define `msg` before capturing the stack trace since it calls `toString()` and we
		// need a message to render
		Object.defineProperties(this, {
			name: { writable: true, value: this.constructor.name },
			msg: { writable: true, value: new Message(...args) }
		});

		// set the default statuses
		this.status = '500';
		this.statusCode = 500;

		const err = args[0];
		if (err instanceof Error) {
			for (const prop of Object.getOwnPropertyNames(err)) {
				if (prop !== 'message' && prop !== 'name') {
					this[prop] = err[prop];
				}
			}

			// the stack may have the wrong class name, so override it
			if (this.stack) {
				this.stack = this.stack.replace(/^(\w*Error:)/, `${this.name}:`);
			}
		} else {
			Error.captureStackTrace(this, this.constructor);
		}
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

	set status(value) {
		this.msg.status = value;
	}

	/**
	 * The error code.
	 * @type {String}
	 */
	get statusCode() {
		return this.msg.statusCode;
	}

	set statusCode(value) {
		this.msg.statusCode = value;
	}

	/**
	 * Formats and returns the error message.
	 *
	 * @param {String} [locale] - The locale used to translate the message.
	 * @returns {String}
	 * @access public
	 */
	toString(locale) {
		const code = this.msg.statusCode ? ` (code ${this.msg.statusCode})` : '';
		return `${this.name}: ${this.msg.toString(locale, 'Unknown Error')}${code}`;
	}
}

Object.defineProperty(AppcdError, 'name', {
	enumerable: true,
	value: 'AppcdError'
});

AppcdError.codes = codes;

/**
 * Helper function to create one-off custom error objects. It's equivalent to creating a custom
 * error class that extends `AppcdError`.
 *
 * @param {String} className - The name of the custom error.
 * @param {Object} [opts] - Additional options.
 * @param {Number} [opts.defaultStatus] - A default status if the error doesn't explicitly have one.
 * @param {Number} [opts.defaultStatusCode] - A default code if the error doesn't explicitly have one.
 * @returns {Function}
 */
export function createErrorClass(className, opts = {}) {
	if (!className || typeof className !== 'string') {
		throw new TypeError('Expected custom error class name to be a non-empty string');
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

			if (this.msg.status === undefined && opts && opts.defaultStatus) {
				this.msg.status = opts.defaultStatus;
			}

			if (this.msg.statusCode === undefined && opts && opts.defaultStatusCode) {
				this.msg.statusCode = opts.defaultStatusCode;
			}
		}
	}

	Object.defineProperty(CustomError, 'name', {
		enumerable: true,
		value: className
	});

	return CustomError;
}
