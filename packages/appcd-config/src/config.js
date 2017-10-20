import appcdLogger from 'appcd-logger';
import fs from 'fs-extra';
import gawk from 'gawk';
import Metadata from './metadata';
import path from 'path';
import vm from 'vm';

import { EventEmitter } from 'events';
import { isFile } from 'appcd-fs';
import { expandPath } from 'appcd-path';
import { parse } from 'babylon';
import { wrap } from 'module';

const { log } = appcdLogger('appcd:config');

/**
 * A config model that loads config files, retrieves settings, changes settings,
 * emits change events, and validates settings based on metadata.
 *
 * @extends {EventEmitter}
 */
export default class Config extends EventEmitter {
	/**
	 * Creates a config instance.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {Object} [opts.config] - A object to initialize the config with.
	 * Note that if a `configFile` is also specified, this `config` is applied
	 * AFTER the config file has been loaded.
	 * @param {String} [opts.configFile] - The path to a .js or .json config
	 * file to load.
	 * @access public
	 */
	constructor(opts = {}) {
		super();

		/**
		 * Config option metadata.
		 * @type {Metadata}
		 * @access public
		 */
		this.meta = new Metadata();

		/**
		 * The internal values object. This object can be accessed directly,
		 * though it is only recommended for read operations. Any write
		 * operations will not be detected and the `change` event will not be
		 * emitted.
		 * @type {Object}
		 * @access public
		 */
		this.values = gawk({});

		this.filename = 'config.json';

		this.location = expandPath(path.join(this.get('home', '~/.appcelerator/appcd'), this.filename));

		if (opts.configFile) {
			this.load(opts.configFile);
		}

		if (opts.config) {
			if (typeof opts.config !== 'object' || Array.isArray(opts.config)) {
				throw new TypeError('Expected config to be an object');
			}
			this.merge(opts.config, { overrideReadonly: true, write: false });
		}
	}

	/**
	 * Loads a config file and merges it into this config instance. It supports
	 * both `.js` and `.json` config files. `.js` config files must export an
	 * object and may optionally contain metadata per config property describing
	 * the datatype and readonly access.
	 *
	 * @param {String} file - The path to a .js or .json config file to load.
	 * @returns {Config}
	 * @access public
	 */
	load(file) {
		if (!file || typeof file !== 'string') {
			throw new TypeError('Expected config file to be a string');
		}

		const ext = path.extname(file);
		if (ext !== '.js' && ext !== '.json') {
			throw new Error('Config file must be a JavaScript or JSON file');
		}

		if (!isFile(file)) {
			throw new Error(`Config file not found: ${file}`);
		}

		// load the metadata file
		// note that this metadata will be overwritten by any inline metadata in
		// the .js file
		this.meta.load(file + '.metadata');

		if (ext === '.json') {
			try {
				log(`Loading JSON config file: ${file}`);
				this.merge(JSON.parse(fs.readFileSync(file)), { overrideReadonly: true });
			} catch (e) {
				throw new Error(`Failed to load config file: ${e}`);
			}
			return this;
		}

		log(`Loading JavaScript config file: ${file}`);
		return this.parseJS(fs.readFileSync(file, 'utf8'), file);
	}

	/**
	 * Parses a string of JavaScript and evaluates it.
	 *
	 * @param {String} code - A string of JavaScript code to parse and eval.
	 * @param {String} [file] - The path to the source file.
	 * @returns {Config}
	 * @access public
	 */
	parseJS(code, file) {
		if (typeof code !== 'string') {
			throw new TypeError('Expected code to be a string');
		}

		code = code.trim();

		if (code === '#!') {
			return this;
		}

		// strip the shebang
		if (code.length > 1 && code[0] === '#' && code[1] === '!') {
			const p = code.indexOf('\n', 2);
			const q = code.indexOf('\r', 2);
			if (p === -1 && q === -1) {
				return this;
			}
			code = code.slice(p === -1 ? q : p);
		}

		// parse the JavaScript AST using Babylon
		let ast;
		try {
			log('Parsing AST...');
			ast = parse(code, {
				plugins: [
					'asyncGenerators',
					'classProperties',
					'doExpressions',
					'dynamicImport',
					'exportExtensions',
					'functionBind',
					'functionSent',
					'objectRestSpread'
				],
				sourceType: 'module'
			});

			this.meta.parse(ast);
		} catch (e) {
			throw new Error(`Failed to load config file: ${e.toString()}`);
		}

		// setup our module to be evaluated
		const ctx = { exports: {} };

		try {
			const compiled = vm.runInNewContext(wrap(code), {
				filename: file && path.basename(file),
				lineOffset: 0,
				displayErrors: false
			});
			const args = [ ctx.exports, require, ctx, file ? path.basename(file) : '', file ? path.dirname(file) : '' ];
			compiled.apply(ctx.exports, args);
		} catch (e) {
			throw new Error(`Failed to load config file: ${e.toString()}`);
		}

		if (!ctx.exports || typeof ctx.exports !== 'object' || Array.isArray(ctx.exports)) {
			throw new Error('Expected config file to export an object');
		}

		this.merge(ctx.exports, { overrideReadonly: true });

		return this;
	}

	/**
	 * Gets a config setting.
	 *
	 * @param {String} key - The dot-notation config key.
	 * @param {*} [defaultValue] - The default value to return if the specified key is not found.
	 * @returns {*} The config value.
	 * @access public
	 */
	get(key, defaultValue) {
		let it = this.values;

		if (key) {
			if (typeof key !== 'string') {
				throw new TypeError('Expected key to be a string');
			}

			const parts = key.split('.');

			for (let i = 0, k; it !== undefined && (k = parts[i++]);) {
				if (typeof it !== 'object' || Array.isArray(it)) {
					return defaultValue;
				}
				it = it[k];
			}
		}

		return it !== undefined ? it : defaultValue;
	}

	/**
	 * Pushes a value onto the end of a config setting
	 * @param  {String} key   The dot-notation config key
	 * @param  {String} value The config balue
	 * @returns {Config}
	 * @emits Config#change
	 * @access public
	 */
	push(key, value) {
		debugger;
		if (!key || (typeof key !== 'string')) {
			throw new TypeError('Expected key to be a string');
		}

		if (!Array.isArray(value)) {
			value = [ value ];
		}

		this.meta.validate(key, value, { action: 'push' });
		key.split('.').reduce((obj, part, i, arr) => {
			if (i + 1 === arr.length) {
				// check if any descendant is read-only
				this.hasReadonlyDescendant(obj[part], key, 'set');
				if (!Array.isArray(obj[part])) {
					if (obj[part]) {
						obj[part] = [ obj[part] ];
					} else {
						obj[part] = [];
					}
				}
				obj[part].push.apply(obj[part], value);
			} else if (typeof obj[part] !== 'object' || Array.isArray(obj[part])) {
				this.hasReadonlyDescendant(obj[part], key, 'set');
				obj[part] = {};
			}
			return obj[part];
		}, this.values);

		this.emit('change');
		this.save();
		return this;
	}

	/**
	 * Adds a value to the start of a config setting
	 * @param  {String} key   The dot-notation config key
	 * @param  {String} value The config balue
	 * @returns {Config}
	 * @emits Config#change
	 * @access public
	 */
	unshift(key, value) {
		if (!key || (typeof key !== 'string')) {
			throw new TypeError('Expected key to be a string or object');
		}

		if (!Array.isArray(value)) {
			value = [ value ];
		}

		this.meta.validate(key, value, { action: 'push' });

		key.split('.').reduce((obj, part, i, arr) => {
			if (i + 1 === arr.length) {
				// check if any descendant is read-only
				this.hasReadonlyDescendant(obj[part], key, 'unshift');
				if (!Array.isArray(obj[part])) {
					if (obj[part]) {
						obj[part] = [ obj[part] ];
					} else {
						obj[part] = [];
					}
				}
				obj[part].unshift.apply(obj[part], value);
			}
			return obj[part];
		}, this.values);

		this.emit('change');
		this.save();
		return this;
	}

	/**
	 * Remove the first value of the config setting and return it
	 * @param  {String} key The dot-notation config key
	 * @returns {*} value The value removed from the config setting
	 */
	shift(key) {
		let it = this.values;

		if (!key || (typeof key !== 'string')) {
			throw new TypeError('Expected key to be a string or object');
		}

		const parts = key.split('.');

		for (let i = 0, k; it !== undefined && (k = parts[i++]);) {
			it = it[k];
		}

		if (!Array.isArray(it)) {
			throw Error('Value is not an array');
		}
		const val = it.shift();
		this.save();
		return val;
	}

	/**
	 * Remove the first value of the config setting and return it
	 * @param  {String} key The dot-notation config key
	 * @returns {*} value The value removed from the config setting
	 */
	pop(key) {
		let it = this.values;

		if (!key || (typeof key !== 'string')) {
			throw new TypeError('Expected key to be a string or object');
		}

		const parts = key.split('.');

		for (let i = 0, k; it !== undefined && (k = parts[i++]);) {
			it = it[k];
		}

		if (!Array.isArray(it)) {
			throw Error('Value is not an array');
		}
		this.emit('change');
		const val = it.pop();
		console.log(it);
		this.save();
		return val;
	}

	/**
	 * Sets a config setting.
	 *
	 * @param {String} key - The dot-notation config key.
	 * @param {*} value - The config value.
	 * @returns {Config}
	 * @emits Config#change
	 * @access public
	 */
	set(key, value) {
		if (!key || (typeof key !== 'string' && (typeof key !== 'object' || Array.isArray(key)))) {
			throw new TypeError('Expected key to be a string or object');
		}

		if (typeof key === 'string') {
			this.meta.validate(key, value, { action: 'set' });

			key.split('.').reduce((obj, part, i, arr) => {
				if (i + 1 === arr.length) {
					// check if any descendant is read-only
					this.hasReadonlyDescendant(obj[part], key, 'set');
					obj[part] = value;
				} else if (typeof obj[part] !== 'object' || Array.isArray(obj[part])) {
					this.hasReadonlyDescendant(obj[part], key, 'set');
					obj[part] = {};
				}
				return obj[part];
			}, this.values);
		} else {
			// key is an object object
			this.merge(key);
		}

		this.emit('change');
		this.save();
		return this;
	}

	/**
	 * Deletes a config setting.
	 *
	 * @param {String} key - The dot-notation config key.
	 * @returns {Boolean} Returns `true` if the key was found, otherwise `false`.
	 * @access public
	 */
	delete(key) {
		const _t = this;
		const m = this.meta.get(key);
		if (m && m.readonly) {
			throw Error('Not allowed to delete read-only property');
		}

		return (function walk(parts, obj) {
			const part = parts.shift();
			if (parts.length) {
				if (obj.hasOwnProperty(part)) {
					const result = walk(parts, obj[part]);
					if (result && Object.keys(obj[part]).length === 0) {
						delete obj[part];
					}
					return result;
				}
			} else if (obj[part]) {
				// check if any descendant is read-only
				_t.hasReadonlyDescendant(obj[part], key, 'delete');

				delete obj[part];
				_t.emit('change');
				_t.save();
				return true;
			}
			return false;
		}(key.split('.'), this.values));
	}

	/**
	 * Determines if an object contains any properties that are read-only. If it does, then an error
	 * is thrown.
	 *
	 * @param {Object} obj - The object to scan.
	 * @param {String} key - The current key to use when looking up the object's metadata.
	 * @param {String} action - The action to use in the exception message. This is either `set` or
	 * `delete`.
	 * @access private
	 */
	hasReadonlyDescendant(obj, key, action) {
		const m = this.meta.get(key);
		if (m && m.readonly) {
			throw Error(`Not allowed to ${action} property with nested read-only property`);
		}

		if (obj && typeof obj === 'object') {
			for (const k of Object.keys(obj)) {
				this.hasReadonlyDescendant(obj[k], `${key}.${k}`, action);
			}
		}
	}

	/**
	 * Merges an object into the current config.
	 *
	 * @param {Object} values - The values to merge in.
	 * @param {Object} [opts] - Various options.
 	 * @param {Boolean} [opts.overrideReadonly=false] - When true, does not
 	 * enforce readonly.
	 * @returns {Config}
	 * @access public
	 */
	merge(values, opts = {}) {
		if (!values || typeof values !== 'object' || Array.isArray(values)) {
			return this;
		}

		const merger = (dest, src, scope = []) => {
			for (const key of Object.keys(src)) {
				const value = src[key];

				scope.push(key);
				this.meta.validate(scope.join('.'), value, opts);

				if (Array.isArray(value)) {
					if (Array.isArray(dest[key])) {
						dest[key].push.apply(dest[key], value);
					} else {
						dest[key] = value.slice();
					}
				} else if (typeof value === 'object' && value !== null) {
					if (typeof dest[key] !== 'object' || dest[key] === null) {
						dest[key] = {};
					}
					merger(dest[key], value, scope);
				} else if (typeof value !== 'undefined') {
					dest[key] = value;
				}

				scope.pop();
			}
		};

		merger(this.values, values);
		if (opts.write) {
			this.save();
		}
		return this;
	}

	/**
	 * Returns a string prepresentation of the configuration.
	 *
	 * @param {Number} [indentation=2] The number of spaces to indent the JSON
	 * formatted output.
	 * @returns {String}
	 * @access public
	 */
	toString(indentation = 2) {
		return JSON.stringify(this.values, null, Math.max(indentation, 0));
	}

	save() {
		try {
			const homeDir = expandPath(this.get('home', '~/.appcelerator/appcd'));
			fs.ensureDirSync(homeDir);
			const tmpFile = this.location + '.' + Date.now() + '.tmp';
			fs.writeFileSync(tmpFile, this.toString());
			console.log(this.location);
			fs.renameSync(tmpFile, this.location);
			console.log(fs.existsSync(this.location));
			console.log(this.toString());
		} catch (e) {
			console.log(e);
		}
	}
	/**
	 * Adds a listener for config changes.
	 *
	 * @param {String|Array.<String>} [filter] - A property name or array of nested properties to
	 * watch.
	 * @param {Function} listener - The function to call when something changes.
	 * @returns {Config}
	 * @access public
	 */
	watch(filter, listener) {
		gawk.watch(this.values, filter, listener);
		return this;
	}

	/**
	 * Removes a config listener.
	 *
	 * @param {Function} listener - The listener callback function.
	 * @returns {Config}
	 * @access public
	 */
	unwatch(listener) {
		gawk.unwatch(this.values, listener);
		return this;
	}
}
