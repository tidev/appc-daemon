import 'source-map-support/register';

import fs from 'fs';
import path from 'path';

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
 * Formats a number using commas.
 *
 * @param {Number} - The number to format.
 * @returns {String}
 */
export function formatNumber(n) {
	return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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
