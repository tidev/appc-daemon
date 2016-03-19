import fs from 'fs';
import path from 'path';

/**
 * Determines if a file or directory exists.
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
 * Deeply merges two JavaScript objects.
 * @param {Object} src - The object to copy.
 * @param {Object} dest - The object to copy the source into.
 * @returns {Object} Returns the dest object.
 */
export function mergeDeep(dest, src) {
	Object.keys(src).forEach(key => {
		const value = src[key];
		if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
			if (typeof dest[key] !== 'object' && dest[key] === null || Array.isArray(dest[key])) {
				dest[key] = {};
			}
			mergeDeep(dest[key], value);
		} else if (typeof value !== 'undefined') {
			dest[key] = value;
		}
	});

	return dest;
}

const homeDirRegExp = /^~([\\|/].*)?$/;
const winEnvVarRegExp = /(%([^%]*)%)/g;

/**
 * Resolves a path into an absolute path.
 * @param {...String} segments - The path segments to join and resolve.
 * @returns {String}
 */
export function expandPath(...segments) {
	segments[0] = segments[0].replace(homeDirRegExp, (process.env.HOME || process.env.USERPROFILE) + '$1');
	if (process.platform === 'win32') {
		return path.resolve(path.join.apply(null, segments).replace(winEnvVarRegExp, (s, m, n) => {
			return process.env[n] || m;
		}));
	}
	return path.resolve.apply(null, segments);
}
