import Dispatcher from 'appcd-dispatcher';
import fs from 'fs';
import path from 'path';
import PluginError from './plugin-error';
import Response, { codes } from 'appcd-response';
import snooplogg from 'snooplogg';
import uuid from 'uuid';
import vm from 'vm';

import { expandPath } from 'appcd-path';
import { isDir, isFile } from 'appcd-fs';
import { wrap } from 'module';

const log = snooplogg.config({ theme: 'detailed' })('appcd:plugin:container').log;
const { highlight } = snooplogg.styles;

/**
 * Loads the plugin in a sandbox and wires up the plugin's dispatcher.
 */
export default class PluginContainer {
	/**
	 * Loads the plugin main file and attempts
	 * @access public
	 */
	constructor(opts = {}) {
		this.plugin = this.load(opts.path);

		/**
		 * An internal map used to dispatch responses to requesters.
		 * @type {Object}
		 * @access private
		 */
		this.requests = {};
	}

	connect() {
	}

	/**
	 * Loads the plugin's main JavaScript file into a sandbox and returns it's main export.
	 *
	 * @param {String} pluginPath - The path to the plugin.
	 * @returns {Object}
	 * @access private
	 */
	load(pluginPath) {
		if (!pluginPath || typeof pluginPath !== 'string') {
			throw new PluginError('Invalid plugin path');
		}

		pluginPath = expandPath(pluginPath);

		if (!isDir(pluginPath)) {
			throw new PluginError('Plugin directory does not exist: %s', pluginPath);
		}

		const pkgJsonFile = path.join(pluginPath, 'package.json');
		if (!isFile(pkgJsonFile)) {
			throw new PluginError('Plugin directory does not contain a package.json: %s', pluginPath);
		}

		let pkgJson;
		try {
			pkgJson = JSON.parse(fs.readFileSync(pkgJsonFile, 'utf8'));
		} catch (e) {
			throw new PluginError('Error reading plugin package.json file (%s): %s', pkgJsonFile, e.message);
		}

		const nodeVersion = pkgJson.engines && pkgJson.engines.node;
		if (nodeVersion && !semver.satisfies(process.version, nodeVersion)) {
			throw new PluginError(`Plugin requires Node.js ${nodeVersion}, but is currently running ${process.version}`);
		}

		// find the main file
		let main = expandPath(pluginPath, pkgJson.main || 'index.js');
		if (isDir(main)) {
			main = path.join(main, 'index.js');
		}
		if (!/\.js$/.test(main)) {
			main += '.js';
		}
		if (!isFile(main)) {
			throw new PluginError('Unable to find plugin main file: %s', pkgJson.main || 'index.js');
		}

		return this.sandbox(main, {
			appcd: {
				call(path, request) {
					return new Promise((resolve, reject) => {
						const id = uuid.v4();

						this.requests[id] = msg => {
							if (Math.floor(msg.status / 100) < 4) {
								resolve(msg);
							} else {
								reject(msg);
							}
						};

						process.send({
							id,
							type: request && request.type || 'call',
							path,
							data: request && request.data || undefined
						});
					});
				}
			},
			console: snooplogg(`plugin:${pkgJson.appcd.name}:${pkgJson.version}`)
		});
	}

	/**
	 * Loads and evals a JavaScript file in a sandbox.
	 *
	 * @param {String} file - The JavaScript file to load.
	 * @param {Object} [globalObj] - The global object to use. Automatically defines `console` if not
	 * explicitly set.
	 * @returns {Object|undefined}
	 */
	sandbox(file, globalObj) {
		// load the js file
		let code = fs.readFileSync(file, 'utf8').trim();

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

		try {
			const ctx = { exports: {} };
			const filename = path.basename(file);
			const compiled = vm.runInNewContext(wrap(code), globalObj, {
				filename,
				lineOffset: 0,
				displayErrors: false
			});

			compiled.apply(ctx.exports, [
				ctx.exports,
				require,
				ctx,
				filename,
				path.dirname(file)
			]);

			return ctx.exports;
		} catch (e) {
			throw new PluginError(e);
		}
	}

	dispatch(msg) {
		switch (msg.type) {
			case 'activate':
				return this.activate();

			case 'response':
				if (this.requests[msg.id]) {
					this.requests[msg.id](msg);
				}
				break;
		}
	}

	async activate() {
		if (typeof this.plugin.activate === 'function') {
			return await this.plugin.activate() || new Response(codes.OK);
		}
	}

	deactivate() {
	}

	call() {
	}

	subscribe() {
	}

	unsubscribe() {
	}
}
