import fs from 'fs';
import path from 'path';
import util from 'util';

import { lookup } from './codes';
import { sprintf } from 'sprintf-js';

const codesCache = {};
const stringsCache = {};
const messagesDir = path.resolve(__dirname, '..', 'messages');
const codeRegExp = /^((\d)\d*)(?:\.(\d+)?)?$/;
const firstLineRegExp = /^#?\s*(.*?)\s*$/m;
const localeRegExp = /^([a-z]{2})(?:[-_](?:\w+[-_])?([A-Z]{2}))?$/;

/**
 * An internal message container. It is designed to be used by various response objects and not
 * directly.
 */
export default class Message {
	/**
	 * Loads a localized message based on the code or message.
	 *
	 * @param {*} [codeOrMessage] - The code or message.
	 * @param {...*} [args] - Additional values to embed in the message.
	 * @access public
	 */
	constructor(codeOrMessage, ...args) {
		let parsed;

		if (codeOrMessage instanceof Error) {
			parsed = codeOrMessage;
			codeOrMessage = codeOrMessage.message;
		} else {
			parsed = parseStatusCode(codeOrMessage);
		}

		this.status     = parsed.status;
		this.statusCode = parsed.statusCode;

		if (parsed.status === undefined) {
			if (typeof codeOrMessage === 'string') {
				this.format = codeOrMessage;
			} else if (codeOrMessage !== undefined) {
				args.unshift(codeOrMessage);
			}
		} else {
			this.format = args.shift();
		}

		this.args = serializeArgs(args);

		// console.log(this);
	}

	/**
	 * The message's status. The value must be either a positive integer or `undefined`.
	 *
	 * @type {Number}
	 * @access public
	 */
	get status() {
		return this._status === undefined ? undefined : this._status;
	}

	set status(value) {
		value = parseInt(value);
		this._status = isNaN(value) ? undefined : Math.max(value, 0);
	}

	/**
	 * Retrieves this error's message.
	 *
	 * @param {String|Array.<String>} [locales] - A list of preferred locales to format the message.
	 * @param {String?} [defaultMsg] - The default message to use when the message is null,
	 * undefined, or an object.
	 * @returns {String}
	 * @access public
	 */
	toString(locales, defaultMsg) {
		let msg;

		// console.log('\nformat', this.format);
		// console.log('args', this.args);
		// console.log('status', this.status);
		// console.log('statusCode', this.statusCode);

		const format = this.format ? (msg = loadMessage(this.format, locales)) : null;

		// console.log('msg', msg);
		// console.log('format', format);

		if (Array.isArray(this.args) && this.args.length) {
			if (format) {
				msg = util.format(format, ...this.args);
			} else if (defaultMsg) {
				msg = util.format('%s: %s', loadMessage(defaultMsg, locales), ...this.args);
			} else {
				msg = util.format('%s', ...this.args);
			}
		}

		if (msg === undefined && this.statusCode) {
			msg = loadMessage(this.statusCode, locales);
		}

		if (msg === undefined) {
			msg = loadMessage(defaultMsg, locales);
		}

		// console.log(msg, typeof msg);

		return msg === undefined ? '' : msg;
	}
}

/**
 * Creates internationalized message functions.
 *
 * @param {String|Array.<String>} [locales] - One or more locales that the i18n functions should
 * try to load the strings from.
 * @returns {Object}
 */
export function i18n(locales) {
	locales = processLocales(locales);

	return {
		/**
		 * Translates a single message.
		 *
		 * @param {String} format - The message.
		 * @param {...*} args - Zero or more args to inject into the message.
		 * @returns {String}
		 */
		__(format, ...args) {
			return util.format(loadString(format, locales), ...args);
		},

		/**
		 * Translates the singular or plural version of a message based on the specified count.
		 *
		 * @param {Number} count - The number to check if the singular or plural message should be
		 * returned.
		 * @param {String} singular - The singular version of the message.
		 * @param {String} plural - The plural version of the message.
		 * @param {...*} args - Zero or more args to inject into the message.
		 * @returns {String}
		 */
		__n(count, singular, plural, ...args) {
			let format = loadString(count === 1 ? singular : plural, locales);
			if (!format) {
				return '';
			}
			format = sprintf(format, count);
			if (format.indexOf('%') !== -1) {
				format = sprintf(format, ...args);
			}
			return format;
		}
	};
}

/**
 * Attempts to load a file based on the code. If the locales does not contain 'en', then it will try
 * to load the 'en' version.
 *
 * @param {Array.<String>} locales - The locales to try to look up the code.
 * @param {String} cls - The code class.
 * @param {String} code - The code.
 * @returns {String|undefined}
 */
function loadCodeFile(locales, cls, code) {
	for (let locale of locales) {
		if (codesCache[locale] && Object.prototype.hasOwnProperty.call(codesCache[locale], code)) {
			return codesCache[locale][code];
		}

		// cache miss

		const name = lookup[code];
		const file = path.join(messagesDir, locale, `${cls}xx`, name ? `${code}-${name}.md` : `${code}.md`);

		try {
			const m = fs.readFileSync(file, 'utf8').match(firstLineRegExp);
			if (m) {
				codesCache[locales] || (codesCache[locales] = {});
				codesCache[locales][code] = m[1];
				return m[1];
			}
		} catch (e) {
			// file probably doesn't exist for this locale
		}
	}
}

/**
 * Attempts to load a message for the given the specific code or message and the locale.
 *
 * @param {String|Number} codeOrMessage - The code or message to look up.
 * @param {String|Array.<String>} [locales] - The message locale to retrieve. Falls back to `en`
 * (English) if not found.
 * @returns {String}
 */
export function loadMessage(codeOrMessage, locales) {
	if (codeOrMessage === '%s' || (typeof codeOrMessage !== 'string' && typeof codeOrMessage !== 'number')) {
		return codeOrMessage;
	}

	locales = processLocales(locales);

	const m = String(codeOrMessage).match(codeRegExp);
	let str;

	if (m && m[2]) {
		if (m[3]) {
			// code and subcode
			str = loadCodeFile(locales, m[2], m[0]);
		}

		if (str === undefined) {
			// code only
			str = loadCodeFile(locales, m[2], m[1]);
		}

		return str;
	}

	// must be a string
	return loadString(codeOrMessage, locales);
}

/**
 * Retrieves the translated string based on the list of preferred locales.
 *
 * @param {String} message - The message to load.
 * @param {Array.<String>} locales - An array of one or more locales to try to load the string from.
 * @returns {String}
 */
function loadString(message, locales) {
	if (!message) {
		return '';
	}

	for (let locale of locales) {
		if (!stringsCache[locale]) {
			try {
				stringsCache[locale] = JSON.parse(fs.readFileSync(path.join(messagesDir, locale, 'strings.json'), 'utf8'));
			} catch (e) {
				// file probably doesn't exist for this locale
			}
		}

		if (stringsCache[locale]) {
			const str = stringsCache[locale][message];
			if (str !== undefined) {
				return str;
			}
		}
	}

	return message;
}

/**
 * Tries to parses the status and status code from the supplied variable.
 *
 * @param {*} value - The variable to parse.
 * @returns {Object}
 */
function parseStatusCode(value) {
	if (typeof value === 'number') {
		if (!isNaN(value)) {
			return {
				status: value,
				statusCode: value
			};
		}
	} else if (typeof value === 'string' && value) {
		const m = value.match(codeRegExp);
		if (m) {
			return {
				status: parseInt(m[1]),
				statusCode: value
			};
		}
	}

	return {};
}

/**
 * Returns an expanded array of locales. If `en-US` is passed in, then it returns `['en-US', 'en']`.
 *
 * @param {String|Array.<String>} [locales] - One or more locales to expand.
 * @return {Array.<String>}
 */
function processLocales(locales) {
	// create the list of preferred locales to try
	const expandedLocales = [];

	if (!locales) {
		locales = [];
	} else if (!Array.isArray(locales)) {
		locales = [ locales ];
	}
	if (locales.indexOf('en') === -1) {
		locales.push('en');
	}

	for (const locale of locales) {
		const m = locale && locale.match(localeRegExp);
		if (m) {
			// add the original locale
			expandedLocales.push(locale);

			// if we have a territory, then add just the language
			if (m[2]) {
				expandedLocales.push(m[1]);
			}
		}
	}

	return expandedLocales;
}

/**
 * Serializes object and array elements of the args array to strings.
 *
 * @param {Array} args - The array of arguments to serialize.
 * @return {Array}
 */
function serializeArgs(args) {
	return args.map(s => {
		return typeof s === 'object' ? JSON.stringify(s) : s;
	});
}
