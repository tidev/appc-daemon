/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import Plugin from './plugin';
import semver from 'semver';
import TunnelStream from './tunnel-stream';

import { createInstanceWithDefaults, StdioStream } from 'snooplogg';

if (!process.connected) {
	console.error('The Appc Daemon plugin host cannot be directly executed.');
	process.exit(2);
}

if (process.argv.length < 3) {
	console.error('Missing plugin path argument.');
	process.exit(3);
}

process.title = 'appcd-plugin-host';

const loggerConfig = {
	maxBrightness: 220,
	minBrightness: 100,
	theme: 'detailed'
};

/**
 * The default logger. Routes all messages through the tunnel to the parent process.
 * @type {SnoopLogg}
 */
const logger = createInstanceWithDefaults()
	.snoop('appcd:plugin:host > ')
	.config(loggerConfig)
	.enable('*')
	.pipe(new TunnelStream, { flush: true })
	.ns('appcd:plugin:host');

/**
 * An error-only logger that routes messages through stderr and the tunnel to the parent process.
 * The key difference here is this logger doesn't snoop because we don't want the plugin detection
 * to pollute stdio.
 * @type {SnoopLogg}
 */
const { error } = createInstanceWithDefaults()
	.config(loggerConfig)
	.enable('*')
	.pipe(new StdioStream, { flush: true, theme: 'minimal' })
	.pipe(new TunnelStream, { flush: true })
	.ns('appcd:plugin:host');

process
	.on('uncaughtException', err => error('Caught exception:', err.stack || err.toString()))
	.on('unhandledRejection', (reason, p) => error('Unhandled Rejection at: Promise ', p, reason));

Promise.resolve()
	.then(async () => {
		// load the plugin
		const plugin = new Plugin(process.argv[2]);

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
	})
	.catch(err => {
		error(err);
		process.exit(1);
	});
