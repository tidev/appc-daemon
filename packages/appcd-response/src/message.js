import AppcdError from './appcd-error';
import fs from 'fs';
import path from 'path';
import util from 'util';

import { lookup } from './codes';
import { isDir } from 'appcd-fs';

const codesCache = {};
const stringsCache = {};
const messagesDir = path.resolve(__dirname, '..', 'messages');
const codeRegExp = /^((\d)\d*)(?:\.(\d+)?)?$/;
const firstLineRegExp = /^#?\s*(.*?)\s*$/m;
const localeRegExp = /^([a-z]{2})(?:[-_](?:\w+[-_])?([A-Z]{2}))?$/;
const modulePathCache = {};

/**
 * Encapsulates a message.
 */
export default class Message {
	/**
	 * Loads a localized message based on the code or message.
	 *
	 * @param {String?} defaultFormat - The default format to use when the message is null,
	 * undefined, or an object.
	 * @param {*} msg - The code or message.
	 */
	constructor(defaultFormat, msg, ...args) {
		if (msg instanceof AppcdError) {
			msg         = msg.msg;
			this.status = msg.status;
			this.code   = msg.code;
			this.format = msg.format;
			this.args   = msg.args;

		} else if (msg instanceof Error) {
			const { status, code } = parseStatusCode(msg.code);
			this.status = status;
			this.code   = code;
			this.format = msg.message;

		} else if (typeof msg === 'number') {
			this.status = msg;
			this.code   = String(msg);
			if (args.length) {
				this.format = args.shift();
				this.args   = serializeArgs(args);
			}

		} else if (typeof msg === 'string') {
			const { status, code } = parseStatusCode(msg);
			this.status = status;
			this.code   = code;
			this.format = status !== null ? args.shift() : msg;
			this.args   = serializeArgs(args);

		} else if (msg) {
			this.status = null;
			this.code   = null;
			this.format = defaultFormat || '%s';
			this.args   = serializeArgs([ msg ]);
		}
	}

	/**
	 * The message's code.
	 * @type {String}
	 */
	get code() {
		return this._code;
	}

	set code(value) {
		this._code = value === null ? null : String(value);
	}

	/**
	 * Retrieves this error's message.
	 *
	 * @param {String|Array.<String>} [locales] - The locale specific message to return.
	 * @returns {String}
	 * @access private
	 */
	toString(locales, defaultMsg) {
		let msg;
		if (this.format) {
			msg = loadMessage(this.format, locales);
			if (Array.isArray(this.args)) {
				msg = util.format(msg, ...this.args);
			}
		} else if (this.code) {
			msg = loadMessage(this.code, locales);
		}
		return msg || (defaultMsg && loadMessage(defaultMsg, locales)) || '';
	}
}

/**
 * Attempts to load a message for the given the specific code or message and the locale.
 *
 * @param {String|Number} codeOrMessage - The code or message to look up.
 * @param {String|Array.<String>} locales - The message locale to retrieve. Falls back to `en`
 * (English) if not found.
 * @returns {String}
 */
export function loadMessage(codeOrMessage, locales=[]) {
	codeOrMessage = String(codeOrMessage);
	const m = codeOrMessage.match(codeRegExp);
	let str;

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

	if (m && m[2]) {
		if (m[3]) {
			// code and subcode
			str = loadCodeFile(expandedLocales, m[2], m[0]);
		}

		if (str === undefined) {
			// code only
			str = loadCodeFile(expandedLocales, m[2], m[1]);
		}

		return str;
	}

	// must be a string

	for (let locale of expandedLocales) {
		if (!stringsCache[locale]) {
			try {
				stringsCache[locale] = JSON.parse(fs.readFileSync(path.join(messagesDir, locale, 'strings.json'), 'utf8'));
			} catch (e) {
				// file probably doesn't exist for this locale
			}
		}

		if (stringsCache[locale]) {
			str = stringsCache[locale][codeOrMessage];
			if (str !== undefined) {
				return str;
			}
		}
	}

	return codeOrMessage;
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
		if (codesCache[locale] && codesCache[locale].hasOwnProperty(code)) {
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
 * Tries to parses the status and code from the supplied variable.
 *
 * @param {String|Number} value - The variable to parse.
 * @access private
 */
function parseStatusCode(value) {
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
function serializeArgs(args) {
	return args.map(s => {
		return typeof s === 'object' ? JSON.stringify(s) : s;
	});
}
