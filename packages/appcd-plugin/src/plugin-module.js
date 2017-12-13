/* eslint security/detect-non-literal-require: 0 */

import appcdLogger from 'appcd-logger';
import builtinModules from 'builtin-modules';
import findup from 'findup-sync';
import fs from 'fs';
import Module from 'module';
import path from 'path';
import PluginError from './plugin-error';
import vm from 'vm';

const { log } = appcdLogger('appcd:plugin:module');
const { highlight } = appcdLogger.styles;

const appcdPackages = (function () {
	const { dependencies } = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json')));
	const re = /^appcd-/;
	return new Set(Object.keys(dependencies).filter(name => re.test(name)));
}());

/**
 * Extends the Node.js `Module` definition to override `require()` and inject the plugin globals.
 */
export default class PluginModule extends Module {
	/**
	 * Helper function to create and cache a plugin module.
	 *
	 * @param {PluginBase} plugin - A reference to the plugin implementation.
	 * @param {String} filename - The full path of the file to load.
	 * @returns {*}
	 * @access public
	 */
	static load(plugin, filename) {
		const cachedModule = Module._cache[filename];
		if (cachedModule) {
			return cachedModule.exports;
		}

		if (builtinModules.indexOf(filename) !== -1) {
			return require(filename);
		}

		const module = new PluginModule(plugin, filename);
		Module._cache[filename] = module;

		try {
			module.load(filename);
		} catch (e) {
			delete Module._cache[filename];

			// the following code is only executed for tests because babel-register fails to parse
			// the code before we have a chance to compile it ourselves
			throwPluginError(e);
		}

		return module.exports;
	}

	/**
	 * Initializes the module definition.
	 *
	 * @param {PluginBase} plugin - A reference to the plugin implementation.
	 * @param {String} filename - The full file path to load.
	 * @access public
	 */
	constructor(plugin, filename) {
		super(path.basename(filename).replace(/\.js$/, ''));
		this.plugin = plugin;
		this.filename = filename;
	}

	/**
	 * Resolves, loads, and returns a plugin module.
	 *
	 * @param {String} request - The full path of the file to load.
	 * @returns {*}
	 * @access public
	 */
	require(request) {
		let filename;

		if (appcdPackages.has(request)) {
			// check if this appcd package is in the plugin's package.json
			let found = false;
			try {
				const file = findup('package.json', { cwd: path.dirname(this.filename) });
				const pkgJson = JSON.parse(fs.readFileSync(file));
				if ((pkgJson.dependencies && pkgJson.dependencies[request]) || (pkgJson.devDependencies && pkgJson.devDependencies[request])) {
					found = true;
					log('Loading plugin\'s appcd dependency: %s', highlight(request));
				}
			} catch (e) {
				// squelch
			}

			if (!found) {
				log('Loading built-in appcd dependency: %s', highlight(request));
				filename = Module._resolveFilename(request, module, false);
			}
		}

		if (!filename) {
			filename = Module._resolveFilename(request, this, false);
		}
		return PluginModule.load(this.plugin, filename);
	}

	/**
	 * Compiles and executes the module code inside a container that injects the plugin globals.
	 *
	 * @param {String} code - A reference to the plugin implementation.
	 * @param {String} filename - The full path to the source file.
	 * @returns {*}
	 * @access private
	 */
	_compile(code, filename) {
		// return if the file only contains an empty shebang
		if (code === '#!') {
			return;
		}

		// strip the shebang
		if (code.length > 1 && code[0] === '#' && code[1] === '!') {
			const p = Math.max(code.indexOf('\n', 2), code.indexOf('\r', 2));
			if (p === -1) {
				return;
			}
			code = code.substring(p);
		}

		const globals = Object.keys(this.plugin.globals).join(', ');

		code = `(function (exports, require, module, __filename, __dirname, ${globals}) {
				${code}
			})`;

		try {
			const closure = vm.runInThisContext(code, {
				filename,
				lineOffset: 0,
				displayErrors: false
			});

			const require = path => this.require(path);
			require.resolve = path => Module._resolveFilename(path, this);
			require.extensions = Module._extensions;
			require.cache = Module._cache;

			const args = [
				this.exports,
				require,
				this,
				filename,
				path.dirname(filename)
			].concat(Object.values(this.plugin.globals));

			return closure.apply(this.exports, args);
		} catch (e) {
			throwPluginError(e);
		}
	}
}

/**
 * Converts an exception to a `PluginError` and throws it.
 *
 * @param {Error} ex - The exception.
 * @throws {PluginError}
 */
function throwPluginError(ex) {
	if (!/^Failed to load plugin/.test(ex.message)) {
		ex.message = `Failed to load plugin: ${ex.message}`;
	}
	if (ex instanceof PluginError) {
		throw ex;
	}
	throw new PluginError(ex);
}
