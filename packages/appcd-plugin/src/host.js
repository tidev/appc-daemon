/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import Plugin from './plugin';
import semver from 'semver';
import TunnelStream from './tunnel-stream';

import { createInstanceWithDefaults } from 'snooplogg';

const logger = createInstanceWithDefaults()
	.snoop('appcd:plugin:host > ')
	.config({
		minBrightness: 50,
		theme: 'detailed'
	})
	.enable('*')
	.pipe(new TunnelStream, { flush: true })
	.ns('appcd:plugin:host');

process
	.on('uncaughtException', err => logger.error('Caught exception:', err.stack || err.toString()))
	.on('unhandledRejection', (reason, p) => logger.error('Unhandled Rejection at: Promise ', p, reason));

Promise.resolve()
	.then(async () => {
		// load the plugin
		const plugin = new Plugin(process.argv[2]);

		if (plugin.type !== 'external') {
			throw new Error(`Invalid plugin type "${plugin.type}". Only "external" plugins can be run from the plugin host process.`);
		}

		if (plugin.nodeVersion && !semver.satisfies(process.version, plugin.nodeVersion)) {
			throw new Error(`External plugin requires Node.js ${plugin.nodeVersion}, but currently running ${process.version}`);
		}

		// start the plugin
		await plugin.start();
	})
	.catch(err => {
		logger.error(err.stack || err.toString());
		process.exit(1);
	});
