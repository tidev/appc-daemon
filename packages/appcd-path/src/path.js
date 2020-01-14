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
 * Determines a path's real path by walking from the root to target while resolving symlinks and
 * reconstructing the path. If a path does not exist, it simply appends everything
 *
 * @param {String} path - The path to resolve.
 * @returns {String}
 */
export function real(path) {
	path = expandPath(path);

	const root = _path.resolve('/');
	const dirs = [];
	let dir;

	// chop up the path
	while (path !== root) {
		dirs.unshift(_path.basename(path));
		path = _path.dirname(path);
	}

	// reset path to the root
	path = root;

	// walk the dirs and construct the real path
	while (dir = dirs.shift()) {
		const current = _path.join(path, dir);
		try {
			if (fs.lstatSync(current).isSymbolicLink()) {
				const link = fs.readlinkSync(current);
				path = _path.isAbsolute(link) ? real(link) : _path.resolve(path, link);
			} else {
				path = current;
			}
		} catch (e) {
			// current does not exist which means all subdirectories also do not exist, so just
			// stitch everything back together
			return _path.resolve(current, ...dirs);
		}
	}

	// resolve any relative symlinks we joined together
	return path;
}
