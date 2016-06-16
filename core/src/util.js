import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';

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
 * @param {Object} dest - The object to copy the source into.
 * @param {Object} src - The object to copy.
 * @returns {Object} Returns the dest object.
 */
export function mergeDeep(dest, src) {
	if (typeof dest !== 'object' || dest === null || Array.isArray(dest)) {
		dest = {};
	}

	if (typeof src !== 'object' || src === null || Array.isArray(src)) {
		return dest;
	}

	Object.keys(src).forEach(key => {
		const value = src[key];
		if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
			if (typeof dest[key] !== 'object' || dest[key] === null || Array.isArray(dest[key])) {
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

/**
 * Returns the sha1 of the input string.
 *
 * @param {String} str - The string to hash.
 * @returns {String}
 */
export function sha1(str) {
	return crypto.createHash('sha1').update(str).digest('hex');
}

/**
 * Returns the specified number of random bytes as a hex string.
 *
 * @param {Number} howMany - The number of random bytes to generate.
 * @returns {String}
 */
export function randomBytes(howMany) {
	return crypto.randomBytes(howMany).toString('hex');
}

/**
 * Runs a command and waits for it to finish.
 *
 * @param {String} cmd - The command to spawn.
 * @param {Array} [args] - An array of arguments to pass to the subprocess.
 * @param {Object} [opts] - Spawn options.
 * @returns {Promise}
 */
export function run(cmd, args, opts) {
	if (args && !Array.isArray(args)) {
		opts = args;
		args = [];
	}

	return new Promise((resolve, reject) => {
		const child = spawn(cmd, args, opts);

		let stdout = '';
		let stderr = '';

		child.stdout.on('data', data => stdout += data.toString());
		child.stderr.on('data', data => stderr += data.toString());

		child.on('close', code => {
			if (code === 0) {
				resolve({ code, stdout, stderr });
			} else {
				reject({ code, stdout, stderr });
			}
		});
	});
}

/**
 * Spawns a new node process with the specfied args.
 *
 * @param {Array} [args] - An array of arguments to pass to the subprocess.
 * @param {Object} [opts] - Spawn options.
 * @param {String} [opts.nodePath] - The path to the Node.js executable.
 * @returns {Promise}
 */
export function spawnNode(args = [], opts = {}) {
	const cmd = opts.nodePath || process.env.NODE_EXEC_PATH || process.execPath;
	const v8args = opts.v8args || [];

	// if the user has more than 2GB of RAM, set the max memory to 3GB or 75% of the total memory
	const totalMem = Math.floor(os.totalmem() / 1e6);
	if (totalMem * 0.75 > 1500) {
		v8args.push('--max_old_space_size=' + Math.min(totalMem * 0.75, 3000));
	}
	args.unshift.apply(args, v8args);

	appcd.logger.debug('Executing: ' + appcd.logger.highlight(cmd + ' ' + args.join(' ')));

	return Promise.resolve(spawn(cmd, args, opts));
}
