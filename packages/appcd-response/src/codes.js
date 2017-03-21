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

const dir = path.resolve(__dirname, '..', 'messages', 'en');
const filenameRegExp = /^(\d+(\.\d+)?)\-(.+)\.md$/;

for (const name of fs.readdirSync(dir)) {
	const subdir = path.join(dir, name);
	try {
		for (const name of fs.readdirSync(subdir)) {
			const m = name.match(filenameRegExp);
			if (m) {
				const code = m[2] ? m[1] : parseInt(m[1]);
				codes[m[3]] = code;
				lookup[code] = m[3];
			}
		}
	} catch (e) {}
}
