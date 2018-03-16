import * as t from '@babel/types';

import doctrine from 'doctrine';
import fs from 'fs';
import traverse from '@babel/traverse';

import { isFile } from 'appcd-fs';

/**
 * Exposes metadata for config options as well as validation and
 */
export default class Metadata {
	/**
	 * Creates a metadata instance.
	 *
	 * @access public
	 */
	constructor() {
		Object.defineProperties(this, {
			_map: {
				value: new Map()
			},
			_types: {
				value: {
					array:     it => Array.isArray(it),
					boolean:   it => typeof it === 'boolean',
					null:      it => it === null,
					number:    it => typeof it === 'number',
					object:    it => it !== null && typeof it === 'object' && !Array.isArray(it),
					string:    it => typeof it === 'string',
					undefined: it => typeof it === 'undefined'
				}
			}
		});
	}

	/**
	 * Loads a metadata file, if exists.
	 *
	 * @param {String} file - The path to a metadata file to load.
	 * @access public
	 */
	load(file) {
		if (!file || typeof file !== 'string') {
			throw new TypeError('Expected file to be a string');
		}

		if (!isFile(file)) {
			return;
		}

		try {
			const json = JSON.parse(fs.readFileSync(file));
			if (!json || typeof json !== 'object' || Array.isArray(json)) {
				throw new Error('expected an object');
			}

			for (const key of Object.keys(json)) {
				const entry = json[key];
				if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
					throw new Error(`invalid entry "${key}"`);
				}

				let type = entry.type || null;
				let result;

				if (type) {
					try {
						result = this._createTypeValidator(type);
					} catch (e) {
						throw new Error(`invalid type "${type}" for entry "${key}"`);
					}
				}

				this._map.set(key, {
					desc:       entry.description || entry.desc || '',
					deprecated: entry.deprecated || false,
					nullable:   entry.nullable !== undefined ? entry.nullable !== false : result ? result.nullable : true,
					readonly:   entry.readonly || false,
					type:       result && result.type || type,
					validate:   result && result.validate || (() => true)
				});
			}
		} catch (e) {
			throw new Error(`Failed to load config metadata file: ${e.message}`);
		}
	}

	/**
	 * Parses JSDoc style metadata from a JavaScript file's AST.
	 *
	 * @param {Object} ast - A Babylon AST.
	 * @access public
	 */
	parse(ast) {
		if (!ast || typeof ast !== 'object' || Array.isArray(ast)) {
			throw new TypeError('Expected ast to be an object');
		}

		traverse(ast, {
			ExpressionStatement: path => {
				const { left } = path.node.expression;
				if (t.isMemberExpression(left) && t.isIdentifier(left.object) && left.object.name === 'module' && t.isIdentifier(left.property) && left.property.name === 'exports') {
					let value = path.node.expression.right;

					if (t.isObjectExpression(value)) {
						this._findSettings(path, path.node.expression.right);
						return;
					}

					while (t.isIdentifier(value)) {
						const binding = path.scope.getBinding(value.name);
						if (!binding) {
							return;
						}
						path = binding.path;
						if (!t.isVariableDeclarator(path.node)) {
							break;
						}
						value = path.node.init;
						if (t.isObjectExpression(value)) {
							this._findSettings(path, value);
							break;
						}
					}
				}
			}
		});
	}

	/**
	 * Allows ability to define a function to validate a custom type.
	 *
	 * @param {String} type - The name of the type. All names will be converted to lowercase.
	 * @param {Function} validate - The function to call to validate a value.
	 * @access public
	 */
	registerType(type, validate) {
		if (!type || typeof type !== 'string') {
			throw new TypeError('Expected type to be a string');
		}

		type = type.toLowerCase();
		if (this._types[type]) {
			throw new Error(`Type "${type}" is already registered`);
		}

		if (!validate || typeof validate !== 'function') {
			throw new TypeError('Expected validate to be a function');
		}

		this._types[type] = validate;
	}

	/**
	 * Checks if a config setting has metadata.
	 *
	 * @param {String} key - The config setting's dot-notation key.
	 * @returns {Boolean}
	 * @access public
	 */
	has(key) {
		if (!key || typeof key !== 'string') {
			throw new TypeError('Expected key to be a string');
		}
		return this._map.has(key);
	}

	/**
	 * Retrieves a config setting's metadata.
	 *
	 * @param {String} key - The config setting's dot-notation key.
	 * @returns {Object}
	 * @access public
	 */
	get(key) {
		if (!key || typeof key !== 'string') {
			throw new TypeError('Expected key to be a string');
		}
		return this._map.get(key);
	}

	/**
	 * Removes a config setting's metadata.
	 *
	 * @param {String} key - The config setting's dot-notation key.
	 * @returns {Boolean} Returns true if the metadata existed and was removed.
	 * @access public
	 */
	delete(key) {
		if (!key || typeof key !== 'string') {
			throw new TypeError('Expected key to be a string');
		}
		return this._map.delete(key);
	}

	/**
	 * Sets the metadata for the given key.
	 *
	 * @param {String} key - The config setting's dot-notation key.
	 * @param {Object} [metadata] - A metadata object.
	 * @param {String} [metadata.desc] - The config setting's description.
	 * @param {Boolean|String} [metadata.deprecated=false] - Considers a settings as no longer used
	 * when the value is `true` or a string containing a reason.
	 * @param {Boolean} [metadata.readonly=false] - When true, the value cannot be overwritten.
	 * @param {String} [metadata.type] - A JSDoc style `@type` value meaning it can be one or more
	 * datatype names as well as nullable/non-nullable identifiers.
	 * @param {Function} [metadata.validate] - A function that validates the config setting.
	 * @returns {Metadata}
	 * @access public
	 */
	set(key, metadata = {}) {
		if (!key || typeof key !== 'string') {
			throw new TypeError('Expected key to be a string');
		}

		if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
			throw new TypeError('Expected metadata to be an object');
		}

		const result = metadata.type && this._createTypeValidator(metadata.type);

		this._map.set(key, {
			desc:       metadata.description || metadata.desc || '',
			type:       result && result.type || metadata.type || null,
			deprecated: metadata.deprecated || false,
			nullable:   metadata.nullable !== undefined ? metadata.nullable !== false : result ? result.nullable : true,
			readonly:   metadata.readonly || false,
			validate:   result && result.validate || (() => true)
		});

		return this;
	}

	/**
	 * Uses the metadata to check if a value is valid.
	 *
	 * @param {String} key - The key being validated.
	 * @param {*} value - The value to validate.
	 * @param {Object} [opts] - Various options.
	 * @param {Boolean} [opts.overrideReadonly=false] - When `true`, does not enforce readonly.
	 * @returns {Boolean}
	 * @access public
	 */
	validate(key, value, opts = {}) {
		if (!key || typeof key !== 'string') {
			throw new TypeError('Expected key to be a string');
		}

		const parts = key.split('.');
		const count = parts.length;
		const segments = [];

		for (const part of parts) {
			segments.push(part);
			const meta = this._map.get(segments.join('.'));

			if (!meta) {
				if (segments.length === count) {
					return true;
				}
				continue;
			}

			// check for readonly and datatype
			if (!opts.overrideReadonly && meta.readonly) {
				throw new Error(opts.action
					? `Not allowed to ${opts.action} read-only property`
					: `Config option "${key}" is read-only`);
			}

			if ((meta.nullable && value === null) || meta.validate(value)) {
				return true;
			}

			if (meta.type && segments.length < count) {
				throw new Error(`Cannot overwrite ${meta.type} "${segments.join('.')}" value with object`);
			}

			throw new Error(`Invalid "${key}" value "${value}"`);
		}
	}

	/**
	 * Creates a validate function for the given type.
	 *
	 * @param {String} type - The datatype to parse.
	 * @returns {Function}
	 * @access private
	 */
	_createTypeValidator(type) {
		const tag = doctrine.parse(`@type {${type}}`).tags[0];
		type = doctrine.type.stringify(tag.type, { compact: true });

		const fns = this._processMetaType(tag.type);
		return {
			type,
			validate: fns.length ? it => fns.some(fn => fn(it)) : null,
			nullable: tag.type.type !== 'NonNullableType'
		};
	}

	/**
	 * Loops over a Babylon ObjectExpression's properties to find comments and descend into child
	 * ObjectExpressions.
	 *
	 * @param {Object} path - A Babylon AST path object.
	 * @param {Object} node - A Babylon AST path node object.
	 * @param {String[]} crumbs=[] - A list of scope names used to construct the config setting's
	 * dot-notation key.
	 * @access private
	 */
	_findSettings(path, node, crumbs = []) {
		for (const prop of node.properties) {
			if (!t.isObjectProperty(prop) || !t.isIdentifier(prop.key)) {
				continue;
			}

			if (prop.leadingComments) {
				for (const comment of prop.leadingComments) {
					if (comment.type === 'CommentBlock') {
						this._parseDocs(crumbs.concat(prop.key.name).join('.'), comment.value);
					}
				}
			}

			let { value } = prop;
			while (value && t.isIdentifier(value)) {
				const binding = path.scope.getBinding(value.name);
				if (!binding) {
					value = false;
					break;
				}
				path = binding.path;
				if (!t.isVariableDeclarator(path.node)) {
					value = false;
					break;
				}
				value = path.node.init;
			}

			if (value && t.isObjectExpression(value)) {
				crumbs.push(prop.key.name);
				this._findSettings(path, value, crumbs);
				crumbs.pop();
			}
		}
	}

	/**
	 * Parses the docs from a comment block extracted from the AST.
	 *
	 * @param {String} key - The key for the config setting. This should be a dot-notation formatted
	 * string.
	 * @param {String} comment - The comment block to parse.
	 * @access private
	 */
	_parseDocs(key, comment) {
		const ast = doctrine.parse(comment, {
			recoverable: true,
			sloppy: true,
			unwrap: true
		});

		const data = {
			desc:       ast.description || '',
			deprecated: false,
			nullable:   true,
			readonly:   false,
			type:       null,
			validate:   () => true
		};

		for (const tag of ast.tags) {
			switch (tag.title) {
				case 'deprecated':
					data.deprecated = tag.description || true;
					break;

				case 'readonly':
					data.readonly = true;
					break;

				case 'type':
					data.type = doctrine.type.stringify(tag.type, { compact: true });
					if (tag.type.type === 'NonNullableType' && data.nullable) {
						data.nullable = false;
					}
					const fns = this._processMetaType(tag.type);
					if (fns.length) {
						data.validate = it => fns.some(fn => fn(it));
					}
					break;
			}
		}

		this._map.set(key, data);
	}

	/**
	 * Parses a Doctrine AST tag type and constructs an array of validate functions.
	 *
	 * @param {Object} type - A tag "type" from a Doctrine AST.
	 * @returns {Function[]} An array of validate functions.
	 * @access private
	 */
	_processMetaType(type) {
		let result = [];
		let primary = [];
		let secondary = [];

		// the following are basically the only tag types we support or make to
		// support
		switch (type.type) {
			case 'NameExpression':
				const fn = this._types[type.name.toLowerCase()];
				if (fn) {
					result.push(fn);
				}
				break;
			case 'NonNullableType':
			case 'NullableType':
				result.push.apply(result, this._processMetaType(type.expression));
				break;
			case 'NullLiteral':
				result.push(this._types.null);
				break;
			case 'TypeApplication':
				primary = this._processMetaType(type.expression);
				for (const i of type.applications) {
					secondary.push.apply(secondary, this._processMetaType(i));
				}
				if (secondary.length) {
					result.push(it => primary.some(fn => fn(it)) && it.every(elem => secondary.some(fn => fn(elem))));
				} else {
					result = primary;
				}
				break;
			case 'UnionType':
				for (const i of type.elements) {
					secondary.push.apply(secondary, this._processMetaType(i));
				}
				if (secondary.length) {
					result.push(it => secondary.some(fn => fn(it)));
				}
				break;
			case 'UndefinedLiteral':
				result.push(this._types.undefined);
				break;
		}

		return result;
	}
}
