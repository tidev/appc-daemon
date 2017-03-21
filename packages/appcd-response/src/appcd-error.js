import Message from './message';

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

		this.name = 'AppcdError';
		this.msg = new Message('Unknown Error: %s', ...args);

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

/**
 * Helper function to create one-off custom error objects. It's equivalent to creating a custom
 * error class that extends `AppcdError`.
 *
 * @param {String} name - The name of the custom error.
 * @returns {Function}
 */
export function createErrorClass(name) {
	if (!name || typeof name !== 'string') {
		throw new TypeError('Expected custom error name to be a non-empty string');
	}

	class CustomError extends AppcdError {
		constructor(...args) {
			super(...args);
			this.name = name;
		}
	}

	Object.defineProperty(CustomError, 'name', {
		enumerable: true,
		value: name
	});

	return CustomError;
}
