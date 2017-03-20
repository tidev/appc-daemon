import util from 'util';

import { loadMessage } from './message';

const codeRegExp = /^(\d+)(?:\.(?:\d+)?)?$/;

/**
 * A Appc Daemon error. This class can be extended or used as is.
 */
export default class AppcdError extends Error {
	/**
	 * Creates an error instance.
	 *
	 * @param {String|Number|AppcdError|Error|Object} msg
	 */
	constructor(msg, ...args) {
		super();

		this.name = 'AppcdError';

		if (msg instanceof AppcdError) {
			this.status = msg.status;
			this.code   = msg.code;
			this.format = msg.format;
			this.args   = msg.args;

		} else if (msg instanceof Error) {
			const { status, code } = this.parseStatusCode(msg.code);
			this.status = status;
			this.code   = code;
			this.format = msg.message;

		} else if (typeof msg === 'number') {
			this.status = msg;
			this.code   = String(msg);
			if (args.length) {
				this.format = args.shift();
				this.args   = this.serializeArgs(args);
			}

		} else if (typeof msg === 'string') {
			const { status, code } = this.parseStatusCode(msg);
			if (status !== null) {
				this.status = status;
				this.code   = code;
				this.format = args.shift();
			} else {
				this.format = msg;
			}
			this.args = this.serializeArgs(args);

		} else if (msg) {
			this.format = 'Unknown Error: %s';
			this.args = this.serializeArgs([ msg ]);
		}

		Error.captureStackTrace(this, this.constructor);
	}

	/**
	 * Tries to parses the status and code from the supplied variable.
	 *
	 * @param {String|Number} value - The variable to parse.
	 * @access private
	 */
	parseStatusCode(value) {
		if (typeof value === 'number') {
			if (!isNaN(value)) {
				return {
					status: value,
					code: value
				};
			}
		} else if (value) {
			const m = String(value).match(codeRegExp);
			if (m) {
				return {
					status: parseInt(m[1]),
					code: value
				};
			}
		}

		return {
			status: null,
			code: null
		};
	}

	/**
	 * Serializes object and array elements of the args array to strings.
	 *
	 * @param {Array} args - The array of arguments to serialize.
	 * @return {Array}
	 * @access private
	 */
	serializeArgs(args) {
		return args.map(s => {
			return typeof s === 'object' ? JSON.stringify(s) : s;
		});
	}

	/**
	 * Retrieves this error's message.
	 *
	 * @param {String} [locale] - The locale specific message to return.
	 * @returns {String}
	 * @access private
	 */
	getMessage(locale) {
		let msg;
		if (this.format) {
			msg = loadMessage(this.format, locale);
			if (Array.isArray(this.args)) {
				msg = util.format(msg, ...this.args);
			}
		} else if (this.code) {
			msg = loadMessage(this.code, locale);
		}
		return msg || loadMessage('Unknown Error', locale);;
	}

	/**
	 * Returns the 'en' locale specific message.
	 * @type {String}
	 * @access public
	 */
	get message() {
		return this.getMessage();
	}

	/**
	 * Formats and returns the error message.
	 *
	 * @param {String} [locale] - The locale used to translate the message.
	 * @returns {String}
	 * @access public
	 */
	toString(locale) {
		const code = this.code ? ` (code ${this.code})` : '';
		return `${this.name}: ${this.getMessage(locale)}${code}`;
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
