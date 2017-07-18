/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import fs from 'fs';
import _path from 'path';

const homeDirRegExp = /^~([\\|/].*)?$/;
const winRegExp = /^win/;
const winEnvVarRegExp = /(%([^%]*)%)/g;

/**
 * Resolves a path into an absolute path.
 *
 * @param {...String} segments - The path segments to join and resolve.
 * @returns {String}
 */
export function expandPath(...segments) {
	const platform = process.env.APPCD_TEST_PLATFORM || process.platform;
	segments[0] = segments[0].replace(homeDirRegExp, (process.env.HOME || process.env.USERPROFILE) + '$1');
	if (winRegExp.test(platform)) {
		return _path.resolve(_path.join.apply(null, segments).replace(winEnvVarRegExp, (s, m, n) => {
			return process.env[n] || m;
		}));
	}
	return _path.resolve.apply(null, segments);
}

/**
 * Tries to determine the real path for the given path. Unlike `fs.realpathSync()`, it will attempt
 * to figure out the real path even if the path does not exist by resolving the nearest existing
 * parent directory.
 *
 * @param {String} path - The path to resolve.
 * @returns {String}
 */
export function real(path) {
	try {
		return fs.realpathSync(path);
	} catch (e) {
		const basename = _path.basename(path);
		path = _path.dirname(path);
		if (path === _path.dirname(path)) {
			return path;
		}
		return _path.join(real(path), basename);
	}
}
