/* eslint-disable no-confusing-arrow */

import appcdLogger from 'appcd-logger';

import { debounce } from 'appcd-util';
import { EventEmitter } from 'events';

const { log } = appcdLogger('appcd-detect:registry-watcher');
const { highlight, note } = appcdLogger.styles;

const winreglib = process.platform === 'win32' ? require('winreglib') : null;

/**
 * Generates a filter function for the given criteria.
 *
 * @param {String|RegExp} cond - The criteria used for filtering.
 * @returns {Function}
 */
function createFilterFn(cond) {
	return cond instanceof RegExp ? it => cond.test(it) : cond ? it => cond === it : null;
}

/**
 * Helper function that quickly checks if two unsorted arrays are shallowly equal.
 *
 * @param {?Array} a1 - The first array.
 * @param {?Array} a2 - The second array.
 * @returns {Boolean}
 */
function equal(a1, a2) {
	return a1 === a2 || (a1 && a2 && !(a1 < a2) && !(a1 > a2));
}

/**
 * A node in the registry tree representing a specific key, its watch instance, and its state.
 */
class KeyWatcher extends EventEmitter {
	/**
	 * A map of all subkeys being watched.
	 * @type {Object}
	 */
	subkeys = {};

	/**
	 * The state of the key being watched.
	 * @type {Object}
	 */
	state = {
		subkeys: null,
		value: undefined,
		values: null
	};

	/**
	 * A reference to the `winreglib` library.
	 * @type {Object}
	 */
	winreglib = winreglib;

	/**
	 * Initializes the registry key state and wires up the registry key watcher.
	 *
	 * @param {Object} params - An object containing a `key`, `filter`, `hive`, `transform`, and
	 * `value` properties or an array of objects containing the forementioned properties.
	 * @param {Number} [params.depth=0] - The max depth to recursively watch for changes.
	 * @param {Object} [params.filter] - An object containing `subkeys` and/or `values` properties
	 * and used
	 * @param {Object} params.key - The name of the registry key to watch.
	 * @param {Function} [params.transform] - A function that transforms the incoming returns an object containing
	 * `isDefault` and `value` properties.
	 * @param {String} [params.value] - The name of the value to collect.
	 * @access public
	 */
	constructor(params) {
		super();
		Object.assign(this, params);

		this.update();

		log(`Start watching key: ${highlight(params.key)} ${note(`(depth=${params.depth})`)}`);

		// start watching the key
		this.handle = winreglib.watch(params.key).on('change', async ({ type }) => {
			log(`${highlight(params.key)} changed (type=${type})`);

			if (this.update()) {
				this.emit('change');
			}

			if (type === 'delete') {
				// deleted, nuke subkeys
				this.destroy(true);

			} else if (type !== 'delete') {
				// add or change
				this.initSubkeys();
			}
		});

		this.initSubkeys();
	}

	/**
	 * Destroys this watch instance.
	 *
	 * @param {Boolean} [subkeysOnly=false] - When `true`, only subkeys are destroyed. When
	 * `false`, this watch instance is completely stopped and cleaned up.
	 * @access public
	 */
	destroy(subkeysOnly) {
		if (!subkeysOnly) {
			this.handle.stop();
			this.removeAllListeners();
		}
		for (const [ key, subkey ] of Object.entries(this.subkeys)) {
			subkey.destroy();
			delete this.subkeys[key];
		}
	}

	/**
	 * Returns the value when `value` name is defined.
	 *
	 * @returns {*}
	 * @access public
	 */
	getValue() {
		return this.state.value;
	}

	/**
	 * Returns the value when `value` name is defined.
	 *
	 * @returns {*}
	 * @access private
	 */
	initSubkeys() {
		if (this.depth) {
			// add or change
			for (const subkey of this.state.subkeys) {
				if (!this.subkeys[subkey]) {
					this.subkeys[subkey] = new KeyWatcher({
						depth: this.depth - 1,
						key: `${this.key}\\${subkey}`
					}).on('change', (...args) => this.emit('change', ...args));
				}
			}
		}
	}

	/**
	 * Refreshes the key's subkeys and values. It returns `true` if the state changed.
	 *
	 * @returns {Boolean}
	 * @access private
	 */
	update() {
		let changed = false;
		let subkeys = null;
		let value;
		let values = null;

		try {
			const state = winreglib.list(this.key);
			subkeys = (this.filter && this.filter.subkeys ? state.subkeys.filter(this.filter.subkeys) : state.subkeys).sort();
			values  = (this.filter && this.filter.values  ? state.values.filter(this.filter.values)   : state.values).sort();
		} catch (e) {
			// squelch
		}

		changed = !equal(this.state.subkeys, subkeys) || !equal(this.state.values, values);

		if (this.value) {
			try {
				const obj = { value: winreglib.get(this.key, this.value) };
				value = this.transform && this.transform(obj, this) || obj;
				changed = changed || JSON.stringify(value) !== JSON.stringify(this.state.value);
			} catch (e) {
				// squelch
			}
		}

		this.state = { subkeys, value, values };

		return changed;
	}
}

/**
 * Orchestrates the watching of a registry key.
 */
export default class RegistryWatcher extends EventEmitter {
	/**
	 * A list of keys that are being watched.
	 * @type {Array.<Object>}
	 */
	keys = [];

	/**
	 * A list of objects containing a `value` property as well as any other arbitrary data.
	 * @type {Array.<Object>}
	 */
	values = [];

	/**
	 * A tree of registry key watchers.
	 * @type {Object}
	 */
	watchers = [];

	/**
	 * Validates and initializes the watcher parameters.
	 *
	 * @param {Object} params - An object containing a `key`, `filter`, `hive`, `transform`, and
	 * `value` properties or an array of objects containing the forementioned properties.
	 * @param {Number} [params.depth=0] - The max depth to recursively watch for changes.
	 * @param {Object} [params.filter] - An object containing `subkeys` and/or `values` properties
	 * and used
	 * @param {String} [params.hive] - The name of the Windows Registry hive. If `key` is set, then
	 * the name of the registry hive is prepended to the `key`. This should only be set when `key`
	 * is set, not `keys`.
	 * @param {Object} params.key - The name of the registry key to watch.
	 * @param {Function} [params.transform] - A function that transforms the incoming returns an object containing
	 * `isDefault` and `value` properties.
	 * @param {String} [params.value] - The name of the value to collect.
	 * @access public
	 */
	constructor(params) {
		if (!params || typeof params !== 'object') {
			throw new TypeError('Expected registry watcher params to be an object');
		}

		super();

		const { depth, filter, hive, key, transform, value } = params;
		const data = {
			depth: 0,
			filter: {},
			key,
			transform,
			value
		};

		if (!key || typeof key !== 'string') {
			throw new TypeError('Expected registry watcher "key" param to be a non-empty string');
		}

		if (depth !== undefined) {
			if (typeof depth !== 'number' || depth < 0) {
				throw new TypeError('Expected registry watcher "depth" param to be a positive integer');
			}
			data.depth = depth;
		}

		if (filter !== undefined) {
			if (typeof filter !== 'object' || Array.isArray(filter)) {
				throw new TypeError('Expected registry watcher "filter" param to be an object');
			}

			if (filter.values !== undefined) {
				if (!filter.values || (typeof filter.values !== 'string' && !(filter.values instanceof RegExp))) {
					throw new TypeError('Expected registry watcher "values" filter param to be a non-empty string or regex');
				}
				data.filter.values = createFilterFn(filter.values);
			}
			if (filter.subkeys !== undefined) {
				if (!filter.subkeys || (typeof filter.subkeys !== 'string' && !(filter.subkeys instanceof RegExp))) {
					throw new TypeError('Expected registry watcher "subkeys" filter param to be a non-empty string or regex');
				}
				data.filter.subkeys = createFilterFn(filter.subkeys);
			}
		}

		if (hive !== undefined) {
			if (!hive || typeof hive !== 'string') {
				throw new TypeError('Expected registry watcher "hive" param to be a non-empty string');
			}
			data.key = `${hive}\\${data.key}`;
		}

		if (transform !== undefined && typeof transform !== 'function') {
			throw new TypeError('Expected registry watcher "transform" param to be a function');
		}

		if (value !== undefined && (!value || typeof value !== 'string')) {
			throw new TypeError('Expected registry watcher "value" param to be a non-empty string');
		}

		this.keys.push(data);

		this.notify = debounce(() => {
			this.refreshValues();
			this.emit('change');
		});
	}

	/**
	 * Aggregates values from all watchers that are watching values.
	 *
	 * @access private
	 */
	refreshValues() {
		const values = [];
		for (const w of this.watchers) {
			let value = w.getValue();
			if (value) {
				values.push(value);
			}
		}
		this.values = values;
	}

	/**
	 * Wires up the registry key watchers.
	 *
	 * @returns {RegistryWatcher}
	 * @access public
	 */
	start() {
		for (const params of this.keys) {
			const w = new KeyWatcher(params);
			w.on('change', () => this.notify());
			this.watchers.push(w);
		}

		this.refreshValues();
		return this;
	}

	/**
	 * Stops the registry key watchers.
	 *
	 * @access public
	 */
	stop() {
		let w;
		while (w = this.watchers.shift()) {
			w.destroy();
		}
	}
}
