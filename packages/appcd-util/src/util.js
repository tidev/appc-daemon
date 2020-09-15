/* eslint-disable node/no-deprecated-api */

/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import crypto from 'crypto';
import fs from 'fs';
import get from 'lodash.get';
import set from 'lodash.set';
import semver from 'semver';

import { ChildProcess, execSync, spawnSync } from 'child_process';
import { EventEmitter } from 'events';
import { isFile } from 'appcd-fs';
import { Server, Socket } from 'net';

function getBinding(name) {
	try {
		return process.binding(name);
	} catch (e) {
		// squelch
	}
	return {};
}
const { FSEvent } = getBinding('fs_event_wrap');
const { Timer } = getBinding('timer_wrap');

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
	const required = pkgJson && ((pkgJson.appcd && pkgJson.appcd.node) || (pkgJson.engines && pkgJson.engines.node));

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

	function debouncer(...args) {
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
	}

	debouncer.cancel = function cancel() {
		clearTimeout(timer);
		timer = null;
	};

	return debouncer;
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
 * {@link https://lodash.com/docs/4.17.15#get}.
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

	if (typeof process._getActiveHandles === 'function') {
		for (let handle of process._getActiveHandles()) {
			if (Timer && handle instanceof Timer) {
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
			} else if (handle instanceof EventEmitter && typeof handle.start === 'function' && typeof handle.close === 'function' && FSEvent && handle._handle instanceof FSEvent) {
				handles.fsWatchers.push(handle);
			} else {
				handles.other.push(handle);
			}
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
 * Removes non-serializable properties and circular references from a value such that it can be
 * printed, sent over an IPC channel, or JSON stringified.
 *
 * @param {*} it - The value to scrub.
 * @returns {*}
 */
export function makeSerializable(it) {
	let values = new Set();

	try {
		return (function dupe (src) {
			const type = typeof src;

			if (type === 'number' && isNaN(src)) {
				return null;
			}

			if (src === null || type === 'string' || type === 'number' || type === 'boolean' || src instanceof Date) {
				return src;
			}

			if (type === 'object') {
				if (values.has(src)) {
					return;
				}

				values.add(src);

				if (Array.isArray(src)) {
					return src.map(dupe);
				}

				const obj = {};
				for (let [ key, value ] of Object.entries(src)) {
					obj[key] = dupe(value);
				}
				return obj;
			}
		}(it));
	} finally {
		values.clear();
		values = null;
	}
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
 * Ensures that a function is only executed by a single task at a time. If the function is currently
 * being run, then additional requests are queued and areexecuted in order when the function
 * completes.
 *
 * @param {String} name - The mutex name.
 * @param {Function} callback - A function to call mutually exclusive.
 * @returns {Promise} Resolves whatever value `callback` returns/resolves.
 */
export async function mutex(name, callback) {
	return new Promise((resolve, reject) => {
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
		(async function next() {
			const pending = pendingMutexes[name] && pendingMutexes[name].shift();
			if (!pending) {
				// all done
				delete pendingMutexes[name];
				return;
			}

			// call the function
			try {
				const result = await pending.callback();
				pending.resolve(result);
			} catch (err) {
				pending.reject(err);
			} finally {
				next();
			}
		}());
	});
}

/**
 * Tries to resolve the operating system name and version.
 *
 * @returns {Object}
 */
export function osInfo() {
	let name = null;
	let version = null;

	switch (process.platform) {
		case 'darwin':
			{
				const stdout = spawnSync('sw_vers').stdout.toString();
				let m = stdout.match(/ProductName:\s+(.+)/i);
				if (m) {
					name = m[1];
				}
				m = stdout.match(/ProductVersion:\s+(.+)/i);
				if (m) {
					version = m[1];
				}
			}
			break;

		case 'linux':
			name = 'GNU/Linux';

			if (isFile('/etc/lsb-release')) {
				const contents = fs.readFileSync('/etc/lsb-release', 'utf8');
				let m = contents.match(/DISTRIB_DESCRIPTION=(.+)/i);
				if (m) {
					name = m[1].replace(/"/g, '');
				}
				m = contents.match(/DISTRIB_RELEASE=(.+)/i);
				if (m) {
					version = m[1].replace(/"/g, '');
				}
			} else if (isFile('/etc/system-release')) {
				const parts = fs.readFileSync('/etc/system-release', 'utf8').split(' ');
				if (parts[0]) {
					name = parts[0];
				}
				if (parts[2]) {
					version = parts[2];
				}
			}
			break;

		case 'win32':
			{
				const stdout = spawnSync('wmic', [ 'os', 'get', 'Caption,Version' ]).stdout.toString();
				const s = stdout.split('\n')[1].split(/ {2,}/);
				if (s.length > 0) {
					name = s[0].trim() || 'Windows';
				}
				if (s.length > 1) {
					version = s[1].trim() || '';
				}
			}
			break;
	}

	return {
		name,
		version
	};
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
 * A lookup of various properties that must be redacted during log message serialization.
 * @type {Array.<String|RegExp>}
 */
const mandatoryRedactedProps = [
	/clientsecret/i,
	/password/i
];

/**
 * A list of regexes that will trigger the entire string to be redacted.
 * @type {Array.<String|RegExp>}
 */
const mandatoryRedactionTriggers = [
	/password/i
];

/**
 * A list of string replacement arguments.
 * @type {Array.<Array|String>}
 */
const mandatoryReplacements = [
	[ process.env.HOME, '<HOME>' ],
	process.env.USER,
	/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g // email address
];

/**
 * Scrubs any potentially sensitive data from a value. By default, if the source is an object, it
 * will be mutated. Redacted properties or elements will not be removed.
 *
 * @param {*} data - The source object to copy from.
 * @param {Object} [opts] - Various options.
 * @param {Boolean} [opts.clone] - When `true`, objects and arrays are cloned instead of mutated.
 * @param {Array|Set} [opts.props] - A list of properties to redact.
 * @param {String} [opts.redacted="<REDACTED>"] - The string to replace redacted words with.
 * @param {Array|Set} [opts.replacements] - A list of replacement criteria and an optional value.
 * @param {Array|Set} [opts.triggers] - A list of keywords that cause an entire string to be
 * redacted.
 * @returns {*}
 *
 * @example
 * > redact('foo')
 * 'foo'
 *
 * @example
 * > redact('my password is 123456')
 * '<REDACTED>'
 *
 * @example
 * > redact({
 *     info: {
 *         username: 'chris',
 *         password: '123456,
 *         desktop: '/Users/chris/Desktop'
 *     }
 * })
 * {
 *     info: {
 *         username: '<REDACTED>', // matches process.env.USER
 *         password: '<REDACTED>', // matches blocked property
 *         desktop: '~/Desktop'    // matches process.env.HOME
 *     }
 * }
 */
export function redact(data, opts = {}) {
	if (!opts || typeof opts !== 'object') {
		throw new TypeError('Expected options to be an object');
	}

	const redacted = opts.redacted || '<REDACTED>';

	const init = (key, value) => {
		if (Array.isArray(opts[key]) || opts[key] instanceof Set) {
			for (const item of opts[key]) {
				if (item && typeof item === 'string') {
					value.push(new Function('s', `return s === ${JSON.stringify(item.toLowerCase())}`));
				} else if (item instanceof RegExp) {
					value.push(item.test.bind(item));
				} else {
					throw new TypeError(`Expected ${key} to be a set or array of strings or regexes`);
				}
			}
		} else if (opts[key]) {
			throw new TypeError(`Expected ${key} to be a set or array of strings or regexes`);
		}
		return value;
	};

	const props = init('props', mandatoryRedactedProps.map(re => re.test.bind(re)));
	const triggers = init('triggers', mandatoryRedactionTriggers.map(re => re.test.bind(re)));

	// init the replacements
	const replacementMap = new Map();
	const addReplacement = replacements => {
		if (Array.isArray(replacements) || replacements instanceof Set) {
			for (const replacement of replacements) {
				let pattern, value;
				if (Array.isArray(replacement)) {
					([ pattern, value ] = replacement);
				} else if (typeof replacement === 'string' || replacement instanceof RegExp) {
					pattern = replacement;
				} else {
					throw new TypeError('Expected replacements to be an array of replace arguments');
				}
				const key = pattern;
				if (!(pattern instanceof RegExp)) {
					// eslint-disable-next-line security/detect-non-literal-regexp
					pattern = new RegExp(pattern, 'ig');
				}
				if (value === undefined || value === null) {
					value = redacted;
				}
				replacementMap.set(key, s => s.replace(pattern, value));
			}
		} else if (replacements) {
			throw new TypeError('Expected replacements to be an array of replace arguments');
		}
	};
	addReplacement(mandatoryReplacements);
	addReplacement(opts.replacements);
	const replacements = Array.from(replacementMap.values());

	// recursively walk the value and return the result
	return (function scrub(src) {
		let dest = src;
		if (Array.isArray(src)) {
			dest = opts.clone ? [] : src;
			for (let i = 0, len = src.length; i < len; i++) {
				dest[i] = scrub(src[i]);
			}
		} else if (src && typeof src === 'object') {
			dest = opts.clone ? {} : src;
			for (const [ key, value ] of Object.entries(src)) {
				let match = false;
				for (const test of props) {
					if (match = test(key)) {
						dest[key] = redacted;
						break;
					}
				}
				// if we found a match, then we just redacted the whole string and there's no need
				// to scrub it
				if (!match) {
					dest[key] = scrub(value);
				}
			}
		} else if (src && typeof src === 'string') {
			for (const replace of replacements) {
				dest = replace(dest);
				if (dest === redacted) {
					break;
				}
			}
			for (const test of triggers) {
				if (test(dest)) {
					dest = redacted;
					break;
				}
			}
		}
		return dest;
	}(data));
}

/**
 * Re-export of lodash's `set()` function.
 *
 * For more information, visit {@link https://www.npmjs.com/package/lodash.set} or
 * {@link https://lodash.com/docs/4.17.15#set}.
 *
 * @param {Object} obj - The object to modify.
 * @param {Array.<String>|String} [path] - The path of the property to set.
 * @param {*} [defaultValue] - The value to set.
 * @returns {*}
 */
export { set };

/**
 * Returns the sha1 of the specified buffer or string.
 *
 * @param {Buffer|String} data - The buffer or string to hash.
 * @returns {String}
 */
export function sha1(data) {
	return crypto.createHash('sha1').update(Buffer.isBuffer(data) || typeof data === 'string' ? data : JSON.stringify(data)).digest('hex');
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
	return new Promise((resolve, reject) => {
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
	});
}

let activeTimers = {};
let trackTimerAsyncHook;
let trackTimerWatchers = 0;

/**
 * Starts tracking all active timers. Calling the returned callback will stop watching and return
 * a list of all active timers.
 *
 * @returns {Function}
 */
export function trackTimers() {
	if (!trackTimerAsyncHook) {
		try {
			// try to initialize the async hook
			trackTimerAsyncHook = require('async_hooks')
				.createHook({
					init(asyncId, type, triggerAsyncId, resource) {
						if (type === 'Timeout') {
							activeTimers[asyncId] = resource;
						}
					},
					destroy(asyncId) {
						delete activeTimers[asyncId];
					}
				});
		} catch (e) {
			// squelch
		}
	}

	if (trackTimerAsyncHook && trackTimerWatchers === 0) {
		trackTimerAsyncHook.enable();
	}

	trackTimerWatchers++;

	// result cache just in case stop is called multiple times
	let result;

	// return the stop tracking callback
	return () => {
		if (!result) {
			trackTimerWatchers--;

			if (trackTimerAsyncHook) {
				result = Object.values(activeTimers);
				if (trackTimerWatchers === 0) {
					trackTimerAsyncHook.disable();
					// reset the active timers now that we disabled the async hook
					activeTimers = {};
				}
			} else {
				result = getActiveHandles().timers;
			}
		}

		return result;
	};
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
