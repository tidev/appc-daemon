import 'source-map-support/register';

import debug from 'debug';
import fs from 'fs';
import Metadata from './metadata';
import path from 'path';
import vm from 'vm';

import { EventEmitter } from 'events';
import { expandPath } from 'appcd-path';
import { isFile } from 'appcd-fs';
import { parse } from 'babylon';
import { wrap } from 'module';

const log = debug('appcd:config');

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
	 */
	constructor(opts = {}) {
		super();

		/**
		 * Config option metadata.
		 * @type {Metadata}
		 */
		this.meta = new Metadata;

		Object.defineProperty(this, '_values', { value: {} });

		if (opts.configFile) {
			this.load(opts.configFile);
		}

		if (opts.config) {
			if (typeof opts.config !== 'object' || Array.isArray(opts.config)) {
				throw new TypeError('Expected config to be an object');
			}
			this.merge(opts.config, { overrideReadonly: true });
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
				log(`loading JSON config file: ${file}`);
				this.merge(JSON.parse(fs.readFileSync(file)), { overrideReadonly: true });
			} catch (e) {
				throw new Error(`Failed to load config file: ${e}`);
			}
			return this;
		}

		log(`loading JavaScript config file: ${file}`);
		return this.parseJS(fs.readFileSync(file, 'utf8'), file);
	}

	/**
	 * Parses a string of JavaScript and evaluates it.
	 *
	 * @param {String} code - A string of JavaScript code to parse and eval.
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
			log('parsing AST...');
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
	 * @returns {*} The config value.
	 * @access public
	 */
	get(key, defaultValue) {
		if (!key || typeof key !== 'string') {
			throw new TypeError('Expected key to be a string');
		}

		let it = this._values;
		const parts = key.split('.');

		for (let i = 0, k; it !== undefined && (k = parts[i++]);) {
			if (typeof it !== 'object' || Array.isArray(it)) {
				return defaultValue;
			}
			it = it[k];
		}

		return it !== undefined ? it : defaultValue;
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
			if (this.meta) {
				this.meta.validate(key, value);
			}

			key.split('.').reduce((obj, key, i, arr) => {
				if (i + 1 === arr.length) {
					obj[key] = value;
				} else if (typeof obj[key] !== 'object' || Array.isArray(obj[key])) {
					obj[key] = {};
				}
				return obj[key];
			}, this._values);
		} else {
			// key is an object object
			this.merge(key);
		}

		this.emit('change');

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
		return (function walk(keys, obj) {
			const key = keys.shift();
			if (keys.length) {
				if (obj.hasOwnProperty(key)) {
					const result = walk(keys, obj[key]);
					if (result && Object.keys(obj[key]).length === 0) {
						delete obj[key];
					}
					return result;
				}
			} else if (obj[key]) {
				delete obj[key];
				return true;
			}
			return false;
		}(key.split('.'), this._values));
	}

	/**
	 * Merges an object into the current config.
	 *
	 * @param {Object} values - The values to merge in.
	 * @param {Object} [opts] - Various options.
 	 * @param {Boolean} [opts.overrideReadonly=false] - When true, does not
 	 * enforce readonly.
	 * @returns {Config}
	 * @access private
	 */
	merge(values, opts={}) {
		if (!values || typeof values !== 'object' || Array.isArray(values)) {
			return this;
		}

		const merger = (dest, src, scope=[]) => {
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

		merger(this._values, values);

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
		return JSON.stringify(this._values, null, Math.max(indentation, 0));
	}
}
