if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import semver from 'semver';

import { execSync } from 'child_process';
import { isFile } from 'appcd-fs';

let archCache = null;

/**
 * Returns the current machine's architecture. Possible values are `x64` for
 * 64-bit and `x86` for 32-bit (i386/ia32) systems.
 *
 * @param {Boolean} bypassCache=false - When true, re-detects the system
 * architecture, though it will never change.
 * @returns {String}
 */
export function arch(bypassCache) {
	if (archCache && !bypassCache) {
		return archCache;
	}

	// we cache the architecture since it never changes
	const platform = process.env.APPCD_TEST_PLATFORM || process.platform;
	archCache = process.env.APPCD_TEST_ARCH || process.arch;

	if (archCache === 'ia32') {
		if ((platform === 'win32' && process.env.PROCESSOR_ARCHITEW6432) ||
			(platform === 'linux' && /64/.test(execSync('getconf LONG_BIT')))) {
			// it's actually 64-bit
			archCache = 'x64';
		} else {
			archCache = 'x86';
		}
	}

	return archCache;
}

/**
 * Validates that the current Node.js version strictly equals the Node engine
 * version in the specified package.json.
 *
 * @param {Object|String} pkgJson - The pkgJson object or the path to the
 * package.json file.
 * @returns {String} Returns the Node.js version if the current Node.js version
 * is the exact version required, otherwise throws an error.
 * @throws {Error} Either the package.json cannot be parsed or the current
 * Node.js version does not satisfy the required version.
 */
export function assertNodeEngineVersion(pkgJson) {
	if (!pkgJson) {
		throw new TypeError('Expected pkgJson to be an object or string to a package.json file');
	}

	if (typeof pkgJson === 'string') {
		if (!isFile(pkgJson)) {
			throw new Error(`File does not exist: ${pkgJson}`);
		}

		try {
			pkgJson = JSON.parse(fs.readFileSync(pkgJson, 'utf8'));
		} catch (e) {
			throw new Error(`Unable to parse package.json: ${e.message}`);
		}
	} else if (typeof pkgJson !== 'object' || Array.isArray(pkgJson)) {
		throw new TypeError('Expected pkgJson to be an object or string to a package.json file');
	}

	const current = process.env.APPCD_TEST_NODE_VERSION || process.version;
	const required = pkgJson && pkgJson.engines && pkgJson.engines.node;

	try {
		if (!required || semver.eq(current, required)) {
			return true;
		}
	} catch (e) {
		throw new Error(`Invalid Node engine version in package.json: ${required}`);
	}

	throw new Error(`Requires Node.js '${required}', but the current version is '${current}'`);
}

/**
 * Formats a number using commas.
 *
 * @param {Number} - The number to format.
 * @returns {String}
 */
export function formatNumber(n) {
	return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Determines if a class extends another class.
 *
 * @param {Class|Function} subject - The class to check.
 * @param {Class|Function} base - The base class to look for.
 * @returns {Boolean}
 */
export function inherits(subject, base) {
	if (typeof subject !== 'function') {
		throw new Error('Expected subject to be a function object');
	}

	if (base !== null && typeof base !== 'function') {
		throw new Error('Expected base class to be a function object');
	}

	let proto = Object.getPrototypeOf(subject);
	while (proto !== Function.prototype) {
		if (proto === base) {
			return true;
		}
		proto = Object.getPrototypeOf(proto);
	}

	if (base === Object.getPrototypeOf(subject.prototype)) {
		return true;
	}

	return false;
}

/**
 * Deeply merges two JavaScript objects.
 *
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

	for (const key of Object.keys(src)) {
		const value = src[key];
		if (Array.isArray(value)) {
			if (Array.isArray(dest[key])) {
				dest[key].push.apply(dest[key], value);
			} else {
				dest[key] = value.slice();
			}
		} else if (typeof value === 'object' && value !== null) {
			if (typeof dest[key] !== 'object' || dest[key] === null || Array.isArray(dest[key])) {
				dest[key] = {};
			}
			mergeDeep(dest[key], value);
		} else if (typeof value !== 'undefined') {
			dest[key] = value;
		}
	}

	return dest;
}

/**
 * Returns the specified number of random bytes as a hex string.
 *
 * @param {Number} howMany - The number of random bytes to generate. Must be
 * greater than or equal to zero.
 * @returns {String}
 */
export function randomBytes(howMany) {
	return crypto.randomBytes(Math.max(~~howMany, 0)).toString('hex');
}

/**
 * Returns the sha1 of the input string.
 *
 * @param {String} str - The string to hash.
 * @returns {String}
 */
export function sha1(str) {
	return crypto.createHash('sha1').update(typeof str === 'string' ? str : JSON.stringify(str)).digest('hex');
}
