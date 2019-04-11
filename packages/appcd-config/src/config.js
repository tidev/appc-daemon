import appcdLogger from 'appcd-logger';
import fs from 'fs-extra';
import gawk from 'gawk';
import Metadata from './metadata';
import path from 'path';
import vm from 'vm';

import { expandPath } from 'appcd-path';
import { isFile } from 'appcd-fs';
import { parse } from '@babel/parser';
import { wrap } from 'module';

const { log } = appcdLogger('appcd:config');
const { highlight } = appcdLogger.styles;

/**
 * A config model that loads config files, retrieves/changes settings, and validates settings based
 * on metadata.
 */
export default class Config {
	/**
	 * The id of the "root" namespace.
	 * @type {Symbol}
	 * @access public
	 */
	static Root = Symbol('root');

	/**
	 * The id of the "user" namespace.
	 * @type {Symbol}
	 * @access public
	 */
	static User = Symbol('user');

	/**
	 * A map of namespace names to config values.
	 * @type {Object}
	 * @access private
	 */
	namespaces = gawk({
		[Config.Root]: {},
		[Config.User]: {}
	});

	/**
	 * An ordered list of namespace config values.
	 * @type {Object}
	 * @access private
	 */
	namespaceOrder = [ Config.Root, Config.User ];

	/**
	 * Config option metadata.
	 * @type {Metadata}
	 * @access public
	 */
	meta = new Metadata();

	/**
	 * A readonly composite view of values.
	 * @type {Object}
	 * @readonly
	 * @access public
	 */
	values = gawk({});

	/**
	 * Creates a config instance.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {Object} [opts.config] - A object to initialize the config with. Note that if a
	 * `configFile` is also specified, this `config` is applied AFTER the config file has been
	 * loaded.
	 * @param {String} [opts.configFile] - The path to a .js or .json config file to load.
	 * @access public
	 */
	constructor(opts = {}) {
		// wire up the gawk watcher that rebuilds the `values` property
		gawk.watch(this.namespaces, () => {
			const obj = {};
			const merge = (src, dest) => {
				for (const [ key, value ] of Object.entries(src)) {
					if (value && typeof value === 'object' && !Array.isArray(value)) {
						if (!dest[key] || typeof dest[key] !== 'object') {
							dest[key] = {};
						}
						merge(value, dest[key]);
					} else {
						dest[key] = value;
					}
				}
			};

			for (const id of this.namespaceOrder) {
				if (this.namespaces[id]) {
					merge(this.namespaces[id], obj);
				}
			}

			gawk.set(this.values, obj);
		});

		// if there's a config file, load it into the root namespace
		if (opts.configFile) {
			this.load(opts.configFile);
		}

		// if there's a JavaScript object config, merge it into the root namespace
		if (opts.config) {
			if (typeof opts.config !== 'object' || Array.isArray(opts.config)) {
				throw new TypeError('Expected config to be an object');
			}
			this.merge(opts.config, { namespace: Config.Root, overrideReadonly: true, write: false });
		}
	}

	/**
	 * Deletes a config setting.
	 *
	 * @param {String} key - The dot-notation config key.
	 * @returns {Boolean} Returns `true` if the key was found, otherwise `false`.
	 * @access public
	 */
	delete(key) {
		const m = this.meta.get(key);

		if (m && m.readonly) {
			throw new Error('Not allowed to delete read-only property');
		}

		let obj = this.namespaces[Config.User];
		const parts = key.split('.');
		const stack = [];

		for (let i = 0, len = parts.length; i < len; i++) {
			const prop = parts[i];
			if (!obj.hasOwnProperty(prop)) {
				break;
			}

			stack.push(obj);

			if (i + 1 === len) {
				this.hasReadonlyDescendant(obj[prop], key, 'delete');
				delete obj[prop];
				parts.pop();
				stack.pop();

				while (stack.length) {
					if (Object.keys(obj).length) {
						break;
					}
					// delete it
					obj = stack.pop();
					delete obj[parts.pop()];
				}

				return true;
			}

			obj = obj[prop];
		}

		return false;
	}

	/**
	 * Scans all namespaces looking for a specific key.
	 *
	 * @param {String} key - The dot-notation config key.
	 * @returns {*} Returns the value or `undefined` if not found.
	 * @access public
	 */
	find(key) {
		if (!key || typeof key !== 'string') {
			throw new TypeError('Expected key to be a string or object');
		}

		const parts = key.split('.');
		let parent = null;
		let prop = null;

		for (const ns of this.namespaceOrder) {
			let obj = this.namespaces[ns];

			for (let i = 0, k; obj !== undefined && (k = parts[i++]);) {
				parent = obj;
				obj = obj[prop = k];
			}

			if (obj !== undefined) {
				return { ns, obj, parent, prop };
			}
		}
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
				if (typeof it !== 'object') {
					return defaultValue;
				}
				it = it[k];
			}
		}

		return it !== undefined ? it : defaultValue;
	}

	/**
	 * Returns an object containing only the user settings.
	 *
	 * @returns {Object}
	 * @access public
	 */
	getUserConfig() {
		return JSON.parse(JSON.stringify(this.namespaces[Config.User]));
	}

	/**
	 * Checks if the config key exists.
	 *
	 * @param {String} key - The dot-notation config key.
	 * @returns {Boolean}
	 * @access public
	 */
	has(key) {
		if (!key || typeof key !== 'string') {
			throw new TypeError('Expected key to be a string');
		}

		let it = this.values;
		const parts = key.split('.');

		for (let i = 0, k; it !== undefined && (k = parts[i++]);) {
			if (typeof it !== 'object' || Array.isArray(it)) {
				return false;
			}
			it = it[k];
		}

		return it !== undefined;
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
			throw new Error(`Not allowed to ${action} property with nested read-only property`);
		}

		if (obj && typeof obj === 'object') {
			for (const k of Object.keys(obj)) {
				this.hasReadonlyDescendant(obj[k], `${key}.${k}`, action);
			}
		}
	}

	/**
	 * Loads a config file and merges it into this config instance. It supports both `.js` and
	 * `.json` config files. `.js` config files must export an object and may optionally contain
	 * metadata per config property describing the datatype and readonly access.
	 *
	 * @param {String} file - The path to a .js or .json config file to load.
	 * @param {Object} [opts] - Various options.
	 * @param {Boolean} [opts.isUserDefined=false] - When `true`, flags the values as "user"
	 * settings which will be persisted when the config is saved.
	 * @param {String} [opts.namespace=Config.Root] - The name of the namespace to merge
	 * the values into.
	 * @param {Boolean} [opts.override=true] - When `true`, overrides existing values.
	 * @returns {Config}
	 * @access public
	 */
	load(file, opts = {}) {
		if (!file || typeof file !== 'string') {
			throw new TypeError('Expected config file to be a string');
		}

		file = expandPath(file);

		const ext = path.extname(file);
		if (ext !== '.js' && ext !== '.json') {
			throw new Error('Config file must be a JavaScript or JSON file');
		}

		if (!isFile(file)) {
			throw new Error(`Config file not found: ${file}`);
		}

		if (opts.namespace && typeof opts.namespace === 'string' && this.namespaceOrder.includes(opts.namespace)) {
			this.unload(opts.namespace);
		}

		// load the metadata file
		// note that this metadata will be overwritten by any inline metadata in the .js file
		this.meta.load(`${file}.metadata`);

		let config;
		try {
			if (ext === '.json') {
				log('Loading JSON config file:', highlight(file));
				config = JSON.parse(fs.readFileSync(file));
			} else {
				// .js file
				log('Loading JavaScript config file:', highlight(file));
				config = this.parseJS(fs.readFileSync(file, 'utf8'), file);
			}
		} catch (e) {
			throw new Error(`Failed to load config file: ${e}`);
		}

		return this.merge(config, {
			namespace: opts.namespace || (opts.isUserDefined ? Config.User : Config.Root),
			overrideReadonly: true
		});
	}

	/**
	 * Loads a config file, flags its settings as "user" settings, and merges the values into the
	 * config object. It supports both `.js` and`.json` config files. `.js` config files must export
	 * an object and may optionally contain metadata per config property describing the datatype and
	 * readonly access.
	 *
	 * @param {String} file - The path to a .js or .json config file to load.
	 * @returns {Config}
	 * @access public
	 */
	loadUserConfig(file) {
		return this.load(file, {
			namespace: Config.User,
			override: true
		});
	}

	/**
	 * Merges an object into the "user" namespace values. If the same property exists in a
	 * different namespace and is an object, it will be copied before merging.
	 *
	 * @param {Object} values - The values to merge in.
	 * @param {Object} [opts] - Various options.
	 * @param {String} [opts.namespace=Config.User] - The name of the namespace to merge the values
	 * into.
	 * @param {Boolean} [opts.override=true] - When `true`, overrides existing values.
	 * @param {Boolean} [opts.overrideReadonly=false] - When `true`, does not enforce read only.
	 * @returns {Config}
	 * @access public
	 */
	merge(values, opts = {}) {
		if (!values || typeof values !== 'object' || Array.isArray(values)) {
			return this;
		}

		let ns = opts.namespace || Config.User;
		let obj = this.namespaces[ns];
		if (obj) {
			this._merge(values, obj, opts);
		} else {
			this.namespaceOrder.splice(1, 0, ns);
			this.namespaces[ns] = typeof ns === 'string' && !values.hasOwnProperty(ns) ? { [ns]: values } : values;
		}

		return this;
	}

	/**
	 * Merges an object into a destination object while taking existing values from namespace
	 * layers under consideration.
	 *
	 * @param {Object} src - The source values.
	 * @param {Object} dest - The destination to copy the values to.
	 * @param {Object} opts - Options for metadata validation.
	 * @param {Array.<Object>} [layers] - An array of namespace layers at the same depth as the
	 * current destination.
	 * @param {Array.<String>} [scope] - An array of keys to the current depth.
	 * @returns {Object}
	 */
	_merge(src, dest, opts, layers, scope = []) {
		if (!layers) {
			layers = this.namespaceOrder.map(ns => this.namespaces[ns]);
		}

		for (const [ key, srcValue ] of Object.entries(src)) {
			scope.push(key);

			const scopeKey = scope.join('.');
			this.meta.validate(scopeKey, srcValue, opts);

			if (srcValue && typeof srcValue === 'object') {
				// get previous value
				let existingValue = layers.reduce((prev, cur) => {
					return cur[key] !== undefined ? cur[key] : prev;
				}, undefined);

				if (Array.isArray(srcValue)) {
					if (Array.isArray(existingValue)) {
						dest[key] = [ ...existingValue, ...srcValue ];
					} else {
						dest[key] = existingValue ? [ existingValue, ...srcValue ] : srcValue;
					}

				// src value is an object
				} else if (existingValue && typeof existingValue === 'object') {
					// merge
					dest[key] = this._merge(srcValue, existingValue, opts, layers.map(obj => obj[key]).filter(obj => obj), scope);
				} else {
					dest[key] = srcValue;
				}
			} else {
				dest[key] = srcValue;
			}

			scope.pop();
		}

		return dest;
	}

	/**
	 * Parses a string of JavaScript and evaluates it.
	 *
	 * @param {String} code - A string of JavaScript code to parse and eval.
	 * @param {String} [file] - The path to the source file.
	 * @returns {Object}
	 * @access private
	 */
	parseJS(code, file) {
		if (typeof code !== 'string') {
			throw new TypeError('Expected code to be a string');
		}

		code = code.trim();

		if (code === '#!') {
			return {};
		}

		// strip the shebang
		if (code.length > 1 && code[0] === '#' && code[1] === '!') {
			const p = code.indexOf('\n', 2);
			const q = code.indexOf('\r', 2);
			if (p === -1 && q === -1) {
				return {};
			}
			code = code.slice(p === -1 ? q : p);
		}

		// parse the JavaScript AST using Babel's parser
		log('Parsing AST...');
		const ast = parse(code, {
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

		// setup our module to be evaluated
		const ctx = { exports: {} };

		const compiled = vm.runInNewContext(wrap(code), {
			filename: file && path.basename(file),
			lineOffset: 0,
			displayerrors: false
		});
		const args = [ ctx.exports, require, ctx, file ? path.basename(file) : '', file ? path.dirname(file) : '' ];
		compiled.apply(ctx.exports, args);

		if (!ctx.exports || typeof ctx.exports !== 'object' || Array.isArray(ctx.exports)) {
			throw new Error('Expected config file to export an object');
		}

		return ctx.exports;
	}

	/**
	 * Remove the first value of the config setting and return it.
	 *
	 * @param {String} key - The dot-notation config key.
	 * @returns {*} The value removed from the config setting.
	 */
	pop(key) {
		const result = this.find(key);

		if (!result || !Array.isArray(result.obj)) {
			throw new TypeError(`Configuration setting ${`"${key}" ` || ''}is not an array`);
		}

		const value = result.obj[result.obj.length - 1];
		this.set(key, result.obj.slice(0, -1));
		return value;
	}

	/**
	 * Pushes a value onto the end of a config setting.
	 *
	 * @param {String} key - The dot-notation config key.
	 * @param {*|Array.<*>} value - The config value.
	 * @returns {Config}
	 * @access public
	 */
	push(key, value) {
		if (!key || typeof key !== 'string') {
			throw new TypeError('Expected key to be a string');
		}

		if (!Array.isArray(value)) {
			value = [ value ];
		}

		this.meta.validate(key, value, { action: 'push' });

		const result = this.find(key);

		if (result) {
			const { ns, obj, parent, prop } = result;
			this.hasReadonlyDescendant(obj, key, 'push');
			if (ns === Config.User) {
				if (Array.isArray(obj)) {
					obj.push.apply(obj, value);
				} else {
					parent[prop] = obj ? [ obj, ...value ] : value;
				}
				return this;
			}

			value = Array.isArray(obj) ? [ ...obj, ...value ] : [ obj, ...value ];
		}

		return this._set(key, value);
	}

	/**
	 * Saves the overwritten configuration settings to the specified file path.
	 *
	 * @param {String} destination - The path to the file to save the config.
	 * @returns {Promise}
	 */
	async save(destination) {
		const tmpFile = `${destination}.${Date.now()}.tmp`;
		await fs.outputFile(tmpFile, JSON.stringify(this.getUserConfig(), null, 4));
		await fs.move(tmpFile, destination, { overwrite: true });
	}

	/**
	 * Sets a config setting into the user namespace.
	 *
	 * @param {String|Object} key - The dot-notation config key.
	 * @param {*} value - The new config value.
	 * @returns {Config}
	 * @access public
	 */
	set(key, value) {
		if (!key || (typeof key !== 'string' && (typeof key !== 'object' || Array.isArray(key)))) {
			throw new TypeError('Expected key to be a string or object');
		}

		if (typeof key === 'object') {
			return this.merge(key);
		}

		this.meta.validate(key, value, { action: 'set' });

		const result = this.find(key);

		if (result) {
			const { ns, obj, parent, prop } = result;
			if (ns === Config.User) {
				this.hasReadonlyDescendant(obj, key, 'set');
				parent[prop] = value;
				return this;
			}
		}

		return this._set(key, value);
	}

	/**
	 * Performs the actual setting of the value in the user namespace without doing any validation.
	 *
	 * @param {String} key - The dot-notation config key.
	 * @param {*} value - The new config value.
	 * @returns {Config}
	 * @access private
	 */
	_set(key, value) {
		key.split('.').reduce((obj, part, i, arr) => {
			if (i + 1 === arr.length) {
				// check if any descendant is read-only
				if (obj[part] !== value) {
					this.hasReadonlyDescendant(obj[part], key, 'set');
					obj[part] = value;
				}
			} else if (typeof obj[part] !== 'object' || Array.isArray(obj[part])) {
				this.hasReadonlyDescendant(obj[part], key, 'set');
				obj[part] = {};
			}

			return obj[part];
		}, this.namespaces[Config.User]);

		return this;
	}

	/**
	 * Remove the first value of the config setting and return it.
	 *
	 * @param {String} key - The dot-notation config key.
	 * @returns {*} The value removed from the config setting.
	 * @access public
	 */
	shift(key) {
		const result = this.find(key);

		if (!result || !Array.isArray(result.obj)) {
			throw new TypeError(`Configuration setting ${`"${key}" ` || ''}is not an array`);
		}

		const value = result.obj[0];
		this.set(key, result.obj.slice(1));
		return value;
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

	/**
	 * Unloads a namespace and its config values. If the namespace does not exist, nothing
	 * happens. You cannot unload the "root" or "user" namespaces.
	 *
	 * @param {String} namespace - The namespace name to unload.
	 * @returns {Boolean} Returns `true` if the namespace exists and was unloaded.
	 * @access public
	 */
	unload(namespace) {
		if (!namespace || typeof namespace !== 'string') {
			throw new TypeError('Expected namespace to be a string');
		}

		if (namespace === Config.Root) {
			throw new Error('Not allowed to unload root namespace');
		}

		if (namespace === Config.User) {
			throw new Error('Not allowed to unload user namespace');
		}

		if (this.namespaces[namespace]) {
			log(`Unloading namespace: ${namespace}`);
			delete this.namespaces[namespace];
			this.namespaceOrder = this.namespaceOrder.filter(ns => ns !== namespace);
			return true;
		}

		return false;
	}

	/**
	 * Adds a value to the start of a config setting.
	 *
	 * @param {String} key - The dot-notation config key.
	 * @param {*|Array.<*>} value - The config value.
	 * @returns {Config}
	 * @access public
	 */
	unshift(key, value) {
		if (!key || typeof key !== 'string') {
			throw new TypeError('Expected key to be a string or object');
		}

		if (!Array.isArray(value)) {
			value = [ value ];
		}

		this.meta.validate(key, value, { action: 'unshift' });

		const result = this.find(key);

		if (result) {
			const { ns, obj, parent, prop } = result;
			this.hasReadonlyDescendant(obj, key, 'unshift');
			if (ns === Config.User) {
				if (Array.isArray(obj)) {
					obj.unshift.apply(obj, value);
				} else {
					parent[prop] = obj ? [ ...value, obj ] : value;
				}
				return this;
			}

			value = Array.isArray(obj) ? [ ...value, ...obj ] : [ ...value, obj ];
		}

		return this._set(key, value);
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
}
