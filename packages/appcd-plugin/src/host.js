/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

if (!process.connected) {
	console.error('The Appc Daemon plugin host cannot be directly executed.');
	process.exit(2);
}

if (process.argv.length < 3) {
	console.error('Missing plugin path argument.');
	process.exit(3);
}

import Plugin from './plugin';
import semver from 'semver';
import TunnelStream from './tunnel-stream';

import { createInstanceWithDefaults, StdioStream } from 'appcd-logger';

process.title = 'appcd-plugin-host';

const ns = `appcd:plugin:host:${process.pid}`;
const logger = createInstanceWithDefaults()
	.snoop(`${ns} > `)
	.config({
		maxBrightness: 220,
		minBrightness: 100,
		theme: 'detailed'
	})
	.enable('*')
	.pipe(new StdioStream(), { flush: true, theme: 'minimal' })
	.pipe(new TunnelStream(), { flush: true });

let { error } = logger.ns(ns);

process
	.on('uncaughtException', err => error('Caught exception:', err.stack || err.toString()))
	.on('unhandledRejection', (reason, p) => error('Unhandled Rejection at:', p, reason));

(async () => {
	try {
		// load the plugin
		const plugin = new Plugin(process.argv[2]);

		error = logger
			.snoop(`${ns}:${plugin} > `)
			.ns(`${ns}:${plugin}`)
			.error;

		process.title = `appcd-plugin-host ${plugin} ${plugin.path}`;

		if (plugin.type !== 'external') {
			error(`Invalid plugin type "${plugin.type}". Only "external" plugins can be run from the plugin host process.`);
			process.exit(4);
		}

		if (plugin.nodeVersion && !semver.satisfies(process.version, plugin.nodeVersion)) {
			error(`This plugin requires Node.js ${plugin.nodeVersion}, but currently running ${process.version}`);
			process.exit(5);
		}

		// start the plugin
		await plugin.start();
	} catch (err) {
		error(err);
		process.exit(1);
	}
})();
