import fs from 'fs';
import path from 'path';

import { lookup } from './codes';
import { isDir } from 'appcd-fs';

const codesCache = {};
const stringsCache = {};
const messagesDir = path.resolve(__dirname, '..', 'messages');
const codeRegExp = /^((\d)\d*)(?:\.(\d+)?)?$/;
const firstLineRegExp = /^#?\s*(.*?)\s*$/m;
const modulePathCache = {};

/**
 * Attempts to load a message for the given the specific code or message and the locale.
 *
 * @param {String|Number} codeOrMessage - The code or message to look up.
 * @param {String} locale - The message locale to retrieve. Falls back to 'en' if not found.
 * @returns {String}
 */
export default function loadMessage(codeOrMessage, locale='en') {
	codeOrMessage = String(codeOrMessage);
	const m = codeOrMessage.match(codeRegExp);
	let str;

	if (m && m[2]) {
		if (m[3]) {
			// code and subcode
			str = loadCodeFile(locale, m[2], m[0]);
		}

		if (str === undefined) {
			// code only
			str = loadCodeFile(locale, m[2], m[1]);
		}

		return str;
	}

	// must be a string
	if (!stringsCache[locale]) {
		try {
			stringsCache[locale] = JSON.parse(fs.readFileSync(path.join(messagesDir, locale, 'strings.json'), 'utf8'));
		} catch (e) {}
	}
	if (stringsCache[locale]) {
		str = stringsCache[locale][codeOrMessage];
		if (str !== undefined) {
			return str;
		}
	}

	// fallback to english
	if (locale !== 'en') {
		if (!stringsCache.en) {
			try {
				stringsCache.en = JSON.parse(fs.readFileSync(path.join(messagesDir, 'en', 'strings.json'), 'utf8'));
			} catch (e) {}
		}
		if (stringsCache.en) {
			str = stringsCache.en[codeOrMessage];
			if (str !== undefined) {
				return str;
			}
		}
	}

	return codeOrMessage;
}

/**
 * Attempts to load a file based on the code. If the locale is not 'en', then it will try to load
 * the 'en' version.
 *
 * @param {String} locale - The locale to try to look up the code.
 * @param {String} cls - The code class.
 * @param {String} code - The code.
 * @returns {String|undefined}
 */
function loadCodeFile(locale, cls, code) {
	if (codesCache[locale] && codesCache[locale].hasOwnProperty(code)) {
		return codesCache[locale][code];
	}

	// cache miss

	const name = lookup[code];
	const file = path.join(messagesDir, locale, `${cls}xx`, name ? `${code}-${name}.md` : `${code}.md`);
	let m;

	try {
		m = fs.readFileSync(file, 'utf8').match(firstLineRegExp);
	} catch (e) {
		// fallback to english
		if (locale !== 'en') {
			const str = loadCodeFile('en', code);
			if (str !== undefined) {
				return str;
			}
		}
	}

	if (m) {
		codesCache[locale] || (codesCache[locale] = {});
		codesCache[locale][code] = m[1];
		return m[1];
	}
}
