import fs from 'fs';
import path from 'path';

/**
 * A map of code names to code numbers.
 * @type {Object}
 */
export const codes = {};

/**
 * A map of code numbers to code names.
 * @type {Object}
 */
export const lookup = {};

const filenameRegExp = /^(\d+(\.\d+)?)-(.+)\.md$/;

/**
 * Loads codes and code names based on filenames in a 'messages' directory. Generally this only
 * needs to be done for the primary locale (i.e. "en").
 *
 * @param {String} dir - The directory to scan.
 */
export function loadCodes(dir) {
	for (const name of fs.readdirSync(dir)) {
		try {
			const subdir = path.join(dir, name);
			for (const name of fs.readdirSync(subdir)) {
				const m = name.match(filenameRegExp);
				if (m) {
					const code = m[2] ? m[1] : parseInt(m[1]);
					codes[m[3]] = code;
					lookup[code] = m[3];
				}
			}
		} catch (e) {
			// squeltch
		}
	}
}

/**
 * Load the built-in 'en' codes.
 */
loadCodes(path.resolve(__dirname, '..', 'messages', 'en'));
