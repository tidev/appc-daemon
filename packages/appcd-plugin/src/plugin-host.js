if (module.parent) {
	throw new Error('appcd-core is meant to be run directly, not require()\'d');
}

/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import Dispatcher from 'appcd-dispatcher';
import fs from 'fs';
import path from 'path';
import PluginError from './plugin-error';
import Response, { codes } from 'appcd-response';
import snooplogg from 'snooplogg';
import Stream from 'stream';
import uuid from 'uuid';
import vm from 'vm';

import { expandPath } from 'appcd-path';
import { isDir, isFile } from 'appcd-fs';
import { wrap } from 'module';

process.title = 'appcd-plugin-host';

const logger = snooplogg.stdio.config({ theme: 'detailed' })('appcd:plugin:host');
const { highlight, note } = snooplogg.styles;

let host = null;

/**
 *
 */
class PluginHost {
	/**
	 * Loads the plugin main file and attempts
	 * @access public
	 */
	constructor(opts = {}) {
		this.plugin = this.load(opts.pluginPath);

		/**
		 * An internal map used to dispatch responses to requesters.
		 * @type {Object}
		 * @access private
		 */
		this.requests = {};
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
		const main = pkgJson.main || 'index.js';
		let mainFile = main;
		if (!/\.js$/.test(mainFile)) {
			mainFile += '.js';
		}
		mainFile = expandPath(pluginPath, mainFile);
		if (!isFile(mainFile)) {
			this.error = `Unable to find plugin main file: ${main}`;
		}

		let code = fs.readFileSync(mainFile, 'utf8').trim();
		if (code === '#!') {
			return;
		}

		// strip the shebang
		if (code.length > 1 && code[0] === '#' && code[1] === '!') {
			const p = code.indexOf('\n', 2);
			const q = code.indexOf('\r', 2);
			if (p === -1 && q === -1) {
				return;
			}
			code = code.slice(p === -1 ? q : p);
		}

		const ctx = { exports: {} };

		try {
			const compiled = vm.runInNewContext(wrap(code), {
				appcd: {
					call: (path, payload) => {
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
								type: payload && payload.type || 'call',
								path,
								data: payload && payload.data || undefined
							});
						});
					}
				},
				console: snooplogg('appcd:plugin:sandbox')
			}, {
				filename: path.basename(mainFile),
				lineOffset: 0,
				displayErrors: false
			});
			const args = [ ctx.exports, require, ctx, path.basename(mainFile), path.dirname(mainFile) ];
			compiled.apply(ctx.exports, args);
		} catch (e) {
			throw new PluginError(`Failed to load config file: ${e.toString()}`);
		}

		// if there are no exports, then we don't have a plugin
		if (!ctx.exports) {
			return;
		}

		// ensure the plugin exports an object
		if (typeof ctx.exports !== 'object') {
			throw new PluginError('Expected plugin to export an object');
		}

		return ctx.exports;
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

process
	.on('uncaughtException', err => snooplogg.error('Caught exception:', err))
	.on('unhandledRejection', (reason, p) => snooplogg.error('Unhandled Rejection at: Promise ', p, reason))
	.on('message', msg => {
		console.log('GOT MESSAGE');
		console.log(msg);

		if (!msg.id) {
			// no id, no service
			return;
		}

		Promise
			.resolve()
			.then(() => {
				if (msg.type === 'init') {
					if (host) {
						throw new PluginError(codes.BAD_REQUEST, 'Plugin host already initialized');
					}

					host = new PluginHost(msg.data || {});
					return {
						response: new Response(codes.OK)
					};
				}

				if (!host) {
					throw new PluginError(codes.BAD_REQUEST, 'Plugin host not initialized');
				}

				return host.dispatch(msg);
			})
			.then(result => {
				if (!result) {
					// no response
					return;
				}

				if (result.response instanceof Response) {
					return {
						status: result.status || codes.OK,
						message: result.response.toString()
					};
				}

				if (result.response instanceof Stream) {
					return new Promise((resolve, reject) => {
						let message = '';
						result
							.on('data', data => {
								message += data.toString();
							})
							.once('end', () => {
								resolve({
									status: result.status || codes.OK,
									message
								});
							})
							.once('error', reject);
					});
				}

				return {
					status: result.status || codes.OK,
					message: result.response
				};
			})
			.then(response => {
				if (response) {
					response.id = msg.id;
					process.send(response);
				}
			})
			.catch(err => {
				logger.error(err);
				process.send({
					id: msg.id,
					status: err instanceof AppcdError && err.status || codes.SERVER_ERROR,
					message: err.toString()
				});
			});
	});
