if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import CLI from 'cli-kit';
import Dispatcher from 'appcd-dispatcher';
import fs from 'fs';
import path from 'path';
import Response from 'appcd-response';
import snooplogg from 'snooplogg';
import vm from 'vm';

import { expandPath } from 'appcd-path';
import { isFile } from 'appcd-fs';
import { wrap } from 'module';

const logger = snooplogg.stdio.config({ theme: 'detailed' })('appcd:plugin:host');
const { highlight, note } = snooplogg.styles;

process
	.on('uncaughtException', err => snooplogg.error('Caught exception:', err))
	.on('unhandledRejection', (reason, p) => snooplogg.error('Unhandled Rejection at: Promise ', p, reason))
	.title = 'appcd-plugin-host';

new CLI({
	args: [
		{ name: 'script', required: true, regex: /\.js$/, desc: 'the script to load' }
	],
	help: false
}).exec()
	.then(({ _ }) => {
		const plugin = loadPlugin(_.shift(), {
			console: snooplogg('appcd:plugin:sandbox')
		});

		process.on('message', msg => {
			switch (msg.type) {
				case 'activate':
					if (typeof plugin.activate === 'function') {
						plugin.activate();
					}
					break;

				case 'deactivate':
					if (typeof plugin.deactivate === 'function') {
						plugin.deactivate();
					}
					break;

				case 'call':
					Dispatcher
						.call(msg.path, msg.data)
						.then(ctx => {
							const result = {
								id: msg.id
							};

							if (ctx.response instanceof Response) {
								result.status = ctx.response.status || codes.OK;
								result.response = ctx.response.toString();
							} else {
								result.status = ctx.status;
								// TODO: if response is a stream, buffer into a string
								result.response = ctx.response;
							}

							process.send(result);
						});
					break;
			}
		});
	})
	.catch(err => {
		logger.error(err);
		process.exit(err.code || 1);
	});

/**
 * Loads the specified JavaScript file in a sandbox and returns it's main export.
 *
 * @param {String} file - The JavaScript file to load.
 * @param {Object} [sandbox] - An object that will be contextified.
 * @returns {Object}
 */
function loadPlugin(file, sandbox) {
	if (!file) {
		throw new Error('Missing script file');
	}

	file = expandPath(file);
	if (!isFile(file)) {
		throw new Error('Script file not found');
	}

	let code = fs.readFileSync(file, 'utf8').trim();
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
		const compiled = vm.runInNewContext(wrap(code), sandbox, {
			filename: path.basename(file),
			lineOffset: 0,
			displayErrors: false
		});
		const args = [ ctx.exports, require, ctx, path.basename(file), path.dirname(file) ];
		compiled.apply(ctx.exports, args);
	} catch (e) {
		throw new Error(`Failed to load config file: ${e.toString()}`);
	}

	// if there are no exports, then we don't have a plugin
	if (!ctx.exports) {
		return;
	}

	// ensure the plugin exports an object
	if (typeof ctx.exports !== 'object') {
		throw new Error('Expected plugin to export an object');
	}

	return ctx.exports;
}
