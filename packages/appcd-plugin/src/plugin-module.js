/* eslint security/detect-non-literal-require: 0 */

import appcdLogger from 'appcd-logger';
import builtinModules from 'builtin-modules';
import findup from 'findup-sync';
import fs from 'fs';
import Module from 'module';
import path from 'path';
import PluginError from './plugin-error';
import semver from 'semver';
import vm from 'vm';

const { log } = appcdLogger('appcd:plugin:module');
const { highlight } = appcdLogger.styles;

const appcdRegExp = /^(appcd-|@appcd\/)/;
const appcdPackages = new Map();
appcdPackages.set('appcd-plugin', JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'))).version);

(function () {
	const { dependencies } = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json')));
	for (const name of Object.keys(dependencies)) {
		if (appcdRegExp.test(name)) {
			try {
				const file = findup('package.json', { cwd: path.dirname(require.resolve(name)) });
				appcdPackages.set(name, JSON.parse(fs.readFileSync(file)).version);
			} catch (e) {
				// squelch
			}
		}
	}
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
	 * @param {Boolean} isMain - Indicates that the file to load is the "main" entrypoint (e.g. has
	 * no parent module).
	 * @returns {*}
	 * @access public
	 */
	static load(plugin, filename, isMain) {
		// generally, we do not need to resolve the filename, but in order for the original,
		// non-transpiled plugin module code to be instrumented for code coverage, we need to call
		// `Module._resolveFilename()`
		const resolvedFilename = Module._resolveFilename(filename, null, isMain);
		if (resolvedFilename !== filename) {
			log(`Resolved ${highlight(filename)} => ${highlight(resolvedFilename)}`);
			filename = resolvedFilename;
		}

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
		this.appcdDeps = {};
		this.injectAppcdDependencies = true;

		// load this plugin's package.json to see if it has any appcd dependencies and whether we
		// should inject the built-in appcd dependencies
		try {
			const file = findup('package.json', { cwd: path.dirname(filename) });
			const pkgJson = JSON.parse(fs.readFileSync(file));

			this.injectAppcdDependencies = !pkgJson.appcd || pkgJson.appcd.injectAppcdDependencies !== false;

			for (const type of [ 'dependencies', 'devDependencies' ]) {
				if (pkgJson[type] && typeof pkgJson[type] === 'object') {
					for (const name of Object.keys(pkgJson[type])) {
						if (appcdRegExp.test(name)) {
							this.appcdDeps[name] = pkgJson[type][name];
						}
					}
				}
			}
		} catch (e) {
			// squelch
		}
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
			if (this.injectAppcdDependencies && (!this.appcdDeps[request] || semver.satisfies(appcdPackages.get(request), this.appcdDeps[request]))) {
				log('Loading built-in appcd dependency: %s', highlight(request));
				filename = Module._resolveFilename(request, module, false);
			} else {
				log('Loading plugin\'s appcd dependency: %s', highlight(request));
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

			const require = request => this.require(request);
			let resolve = (request, options) => Module._resolveFilename(request, this, false, options);
			if (semver.lt(process.version, '8.9.0')) {
				resolve = request => Module._resolveFilename(request, this);
			} else {
				resolve.paths = request => Module._resolveLookupPaths(request, this, true);
			}
			require.resolve = resolve;
			require.extensions = Module._extensions;
			require.cache = Module._cache;
			require.main = process.mainModule;

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
