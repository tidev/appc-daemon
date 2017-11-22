/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import crypto from 'crypto';
import fs from 'fs';
import get from 'lodash.get';
import semver from 'semver';

import { ChildProcess, execSync } from 'child_process';
import { EventEmitter } from 'events';
import { isFile } from 'appcd-fs';
import { Server, Socket } from 'net';

const Timer = process.binding('timer_wrap').Timer;
const FSEvent = process.binding('fs_event_wrap').FSEvent;

let archCache = null;

/**
 * Returns the current machine's architecture. Possible values are `x64` for 64-bit and `x86` for
 * 32-bit (i386/ia32) systems.
 *
 * @param {Boolean} bypassCache=false - When true, re-detects the system architecture, though it
 * will never change.
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
		if ((platform === 'win32' && process.env.PROCESSOR_ARCHITEW6432)
			|| (platform === 'linux' && /64/.test(execSync('getconf LONG_BIT')))) {
			// it's actually 64-bit
			archCache = 'x64';
		} else {
			archCache = 'x86';
		}
	}

	return archCache;
}

/**
 * Ensures that a value is an array. If not, it wraps the value in an array.
 *
 * @param {*} it - The value to ensure is an array.
 * @param {Boolean} [removeFalsey=false] - When `true`, filters out all falsey items.
 * @returns {Array}
 */
export function arrayify(it, removeFalsey) {
	const arr = typeof it === 'undefined' ? [] : it instanceof Set ? Array.from(it) : Array.isArray(it) ? it : [ it ];
	return removeFalsey ? arr.filter(v => typeof v !== 'undefined' && v !== null && v !== '' && v !== false && (typeof v !== 'number' || !isNaN(v))) : arr;
}

/**
 * Validates that the current Node.js version strictly equals the Node engine version in the
 * specified package.json.
 *
 * @param {Object|String} pkgJson - The pkgJson object or the path to the package.json file.
 * @returns {Boolean} Returns `true` if the current Node.js version is the exact version required,
 * otherwise throws an error.
 * @throws {Error} Either the package.json cannot be parsed or the current Node.js version does not
 * satisfy the required version.
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
 * A map of store names to cached results.
 * @type {Object}
 */
const cacheStore = {};

/**
 * Calls a function and caches the result for future calls.
 *
 * @param {String} name - The name to cache the result under.
 * @param {Boolean} [force] - When `true` skips the cache and invokes the function.
 * @param {Function} callback - A function to call to get results.
 * @returns {Promise<*>} Resolves whatever value `callback` returns/resolves.
 */
export async function cache(name, force, callback) {
	await new Promise(setImmediate);

	if (typeof force === 'function') {
		callback = force;
		force = false;
	}

	if (!force && cacheStore[name]) {
		return cacheStore[name];
	}

	return cacheStore[name] = await tailgate(name, callback);
}

/**
 * Calls a synchronous function and caches the result for future calls.
 *
 * @param {String} name - The name to cache the result under.
 * @param {Boolean} [force] - When `true` skips the cache and invokes the function.
 * @param {Function} callback - A function to call to get results.
 * @returns {*} Returns whatever value `callback` returns.
 */
export function cacheSync(name, force, callback) {
	if (typeof force === 'function') {
		callback = force;
		force = false;
	}

	if (typeof name !== 'string' || !name) {
		throw new TypeError('Expected name to be a non-empty string');
	}

	if (typeof callback !== 'function') {
		throw new TypeError('Expected callback to be a function');
	}

	if (!force && cacheStore[name]) {
		return cacheStore[name];
	}

	return cacheStore[name] = callback();
}

/**
 * Prevents a function from being called too many times. This function returns a function that can
 * be used in a promise chain.
 *
 * @param {Function} fn - The function to debounce.
 * @param {Number} [wait=200] - The number of milliseconds to wait between calls to the returned
 * function before firing the specified `fn`.
 * @returns {Function}
 */
export function debounce(fn, wait = 200) {
	let timer;
	wait = Math.max(~~wait, 0);

	let resolveFn;
	let rejectFn;
	const promise = new Promise((resolve, reject) => {
		resolveFn = resolve;
		rejectFn = reject;
	});

	return function debouncer(...args) {
		const ctx = this;
		clearTimeout(timer);

		timer = setTimeout(() => {
			timer = null;
			Promise.resolve()
				.then(() => fn.apply(ctx, args))
				.then(resolveFn)
				.catch(rejectFn);
		}, wait);

		return promise;
	};
}

/**
 * Decodes an string with octals to a utf-8 string.
 *
 * @param {String} input - The string to decode
 * @returns {String} The decoded string
 */
export function decodeOctalUTF8(input) {
	let result = '';
	let i = 0;
	const l = input.length;
	let c;
	let octByte;

	for (; i < l; i++) {
		c = input.charAt(i);
		if (c === '\\') {
			octByte = input.substring(i + 1, i + 4);
			try {
				result += String.fromCharCode(parseInt(octByte, 8));
				i += 3;
			} catch (e) {
				result += '\\';
				input = octByte + input;
			}
		} else {
			result += c;
		}
	}

	return decodeURIComponent(escape(result));
}

/**
 * Formats a number using commas.
 *
 * @param {Number} n - The number to format.
 * @returns {String}
 */
export function formatNumber(n) {
	return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Re-export of lodash's `get()` function.
 *
 * For more information, visit {@link https://www.npmjs.com/package/lodash.get} or
 * {@link https://lodash.com/docs/4.17.4#get}.
 *
 * @param {Object} obj - The object to query.
 * @param {Array.<String>|String} [path] - The path of the property to get.
 * @param {*} [defaultValue] - The value returned for `undefined` resolved values.
 * @returns {*}
 */
export { get };

/**
 * Returns an object with active socket, server, timer, and other handles.
 *
 * @returns {Object}
 */
export function getActiveHandles() {
	const handles = { sockets: [], servers: [], timers: [], childProcesses: [], fsWatchers: [], other: [] };

	for (let handle of process._getActiveHandles()) {
		if (handle instanceof Timer) {
			const timerList = handle._list || handle;
			let t = timerList._idleNext;
			while (t !== timerList) {
				handles.timers.push(t);
				t = t._idleNext;
			}
		} else if (handle instanceof Socket) {
			handles.sockets.push(handle);
		} else if (handle instanceof Server) {
			handles.servers.push(handle);
		} else if (handle instanceof ChildProcess) {
			handles.childProcesses.push(handle);
		} else if (handle instanceof EventEmitter && typeof handle.start === 'function' && typeof handle.close === 'function' && handle._handle instanceof FSEvent) {
			handles.fsWatchers.push(handle);
		} else {
			handles.other.push(handle);
		}
	}

	return handles;
}

/**
 * Determines if a class extends another class.
 *
 * @param {Class|Function} subject - The class to check.
 * @param {Class|Function|null} base - The base class to look for.
 * @returns {Boolean}
 */
export function inherits(subject, base) {
	if (typeof subject !== 'function') {
		throw new TypeError('Expected subject to be a function object');
	}

	if (base !== null && typeof base !== 'function') {
		throw new TypeError('Expected base class to be a function object');
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
 * A map of mutex names to each caller's function and promise callbacks.
 * @type {Object}
 */
export const pendingMutexes = {};

/**
 * Ensures that only a function is executed by a single task at a time. If the function is currently
 * being run, then additional requests are queued and areexecuted in order when the function
 * completes.
 *
 * @param {String} name - The mutex name.
 * @param {Function} callback - A function to call mutually exclusive.
 * @returns {Promise} Resolves whatever value `callback` returns/resolves.
 */
export function mutex(name, callback) {
	// ensure this function is async
	return new Promise(setImmediate)
		.then(() => new Promise((resolve, reject) => {
			// we want this promise to resolve as soon as `callback()` finishes
			if (typeof name !== 'string' || !name) {
				return reject(new TypeError('Expected name to be a non-empty string'));
			}

			if (typeof callback !== 'function') {
				return reject(new TypeError('Expected callback to be a function'));
			}

			// if another function is current running, add this function to the queue and wait
			if (pendingMutexes[name]) {
				pendingMutexes[name].push({ callback, resolve, reject });
				return;
			}

			// init the queue
			pendingMutexes[name] = [ { callback, resolve, reject } ];

			// start a recursive function that drains the queue
			(function next() {
				const pending = pendingMutexes[name] && pendingMutexes[name].shift();
				if (!pending) {
					// all done
					delete pendingMutexes[name];
					return;
				}

				// call the function
				let result;
				try {
					result = pending.callback();
				} catch (err) {
					pending.reject(err);
					return next();
				}

				if (result instanceof Promise) {
					result
						.then(pending.resolve)
						.catch(err => pending.reject(err))
						.then(() => next());
				} else {
					pending.resolve(result);
					next();
				}
			}());
		}));
}

/**
 * Returns the specified number of random bytes as a hex string.
 *
 * @param {Number} howMany - The number of random bytes to generate. Must be greater than or equal
 * to zero.
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

/**
 * Waits a number of milliseconds, then resolves the promise.
 *
 * @param {Number} ms - The number of milliseconds to wait.
 * @returns {Promise}
 */
export function sleep(ms) {
	return new Promise(resolve => {
		if (typeof ms !== 'number') {
			throw new TypeError('Expected timeout milliseconds to be a number');
		}

		if (ms < 0) {
			throw new RangeError('Expected timeout milliseconds to be greater than or equal to zero');
		}

		setTimeout(() => resolve(), ms);
	});
}

/**
 * A map of tailgate names to each caller's promise callbacks.
 * @type {Object}
 */
export const pendingTailgaters = {};

/**
 * Ensures that only a function is executed by a single task at a time. If a task is already
 * running, then additional requests are queued. When the task completes, the result is immediately
 * shared with the queued up callers.
 *
 * @param {String} name - The tailgate name.
 * @param {Function} callback - A function to call to get results.
 * @returns {Promise} Resolves whatever value `callback` returns/resolves.
 */
export function tailgate(name, callback) {
	// ensure this function is async
	return new Promise(setImmediate)
		.then(() => new Promise((resolve, reject) => {
			// we want this promise to resolve as soon as `callback()` finishes
			if (typeof name !== 'string' || !name) {
				return reject(new TypeError('Expected name to be a non-empty string'));
			}

			if (typeof callback !== 'function') {
				return reject(new TypeError('Expected callback to be a function'));
			}

			// if another function is current running, add this function to the queue and wait
			if (pendingTailgaters[name]) {
				pendingTailgaters[name].push({ resolve, reject });
				return;
			}

			// init the queue
			pendingTailgaters[name] = [ { resolve, reject } ];

			const dispatch = (type, result) => {
				const pending = pendingTailgaters[name];
				delete pendingTailgaters[name];
				for (const p of pending) {
					p[type](result);
				}
			};

			// call the function
			let result;
			try {
				result = callback();
			} catch (err) {
				return dispatch('reject', err);
			}

			if (result instanceof Promise) {
				result
					.then(result => dispatch('resolve', result))
					.catch(err => dispatch('reject', err));
			} else {
				dispatch('resolve', result);
			}
		}));
}

/**
 * Removes duplicates from an array and returns a new array.
 *
 * @param {Array} arr - The array to remove duplicates.
 * @returns {Array}
 */
export function unique(arr) {
	const len = Array.isArray(arr) ? arr.length : 0;

	if (len === 0) {
		return [];
	}

	return arr.reduce((prev, cur) => {
		if (typeof cur !== 'undefined' && cur !== null) {
			if (prev.indexOf(cur) === -1) {
				prev.push(cur);
			}
		}
		return prev;
	}, []);
}
