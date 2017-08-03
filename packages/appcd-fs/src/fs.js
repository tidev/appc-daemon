/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import fs from 'fs';
import path from 'path';

/**
 * Determines if a file or directory exists.
 *
 * @param {String} file - The full path to check if exists.
 * @returns {Boolean}
 */
export function existsSync(file) {
	try {
		fs.statSync(file);
		return true;
	} catch (e) {
		return false;
	}
}

/**
 * Determines if a directory exists and that it is indeed a directory.
 *
 * @param {String} dir - The directory to check.
 * @returns {Boolean}
 */
export function isDir(dir) {
	try {
		return fs.statSync(dir).isDirectory();
	} catch (e) {
		// squeltch
	}
	return false;
}

/**
 * Determines if a file exists and that it is indeed a file.
 *
 * @param {String} file - The file to check.
 * @returns {Boolean}
 */
export function isFile(file) {
	try {
		return fs.statSync(file).isFile();
	} catch (e) {
		// squeltch
	}
	return false;
}

/**
 * Scan a directory for a specified file.
 *
 * @param {String} dir - The directory to start searching from.
 * @param {String|RegExp} filename - The name of the file to look for.
 * @param {Number} depth - Optional search depth, default 1 level.
 * @returns {String|null}
 */
export function locate(dir, filename, depth) {
	try {
		if (fs.statSync(dir).isDirectory()) {
			for (const name of fs.readdirSync(dir)) {
				const file = path.join(dir, name);
				try {
					if (fs.statSync(file).isDirectory()) {
						if (typeof depth === 'undefined' || depth > 0) {
							const result = locate(file, filename, typeof depth === 'undefined' ? undefined : depth - 1);
							if (result) {
								return result;
							}
						}
					} else if ((typeof filename === 'string' && name === filename) || (filename instanceof RegExp && filename.test(name))) {
						return file;
					}
				} catch (e) {
					// probably a permission issue, go to next file
				}
			}
		}
	} catch (e) {
		// dir does not exist or permission issue
	}
	return null;
}
