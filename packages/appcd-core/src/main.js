if (module.parent) {
	throw new Error('appcd-core is meant to be run directly, not require()\'d');
}

import { assertNodeEngineVersion } from 'appcd-util';
try {
	assertNodeEngineVersion(`${__dirname}/../package.json`);
} catch (e) {
	console.error(e.message);
	process.exit(1);
}

import CLI from 'cli-kit';
import logger from './logger';
import Server from './server';

const { highlight, note } = logger.styles;

process
	.on('uncaughtException', err => logger.error('Caught unhandled exception:', err))
	.on('unhandledRejection', (reason, p) => logger.error('Caught unhandled rejection at: Promise ', p, reason));

(async () => {
	try {
		const { argv } = await new CLI({
			options: {
				'--config [json]':      { type: 'json', desc: 'serialized JSON string to mix into the appcd config' },
				'--config-file [file]': { type: 'file', desc: 'path to a config file to use instead of the user config file' }
			},
			help: false
		}).exec();

		const server = new Server(argv);
		await server.start();

		// listen for CTRL-C and SIGTERM
		const shutdown = async signal => {
			if (server.state === Server.STARTED || server.state === Server.STARTING) {
				logger.log(`Received signal ${highlight(signal)}, shutting down ${note(`(state=${server.state})`)}`);
				try {
					await server.shutdown();
					process.exit(0);
				} catch (err) {
					logger.error(err);
				}
			} else if (server.state === Server.STOPPED) {
				logger.log(`Received signal ${highlight(signal)}, but server already stopped ${note(`(state=${server.state})`)}`);
			}
			// if state === stopping, then we just ignore it
		};

		process.on('SIGINT', shutdown);
		process.on('SIGTERM', shutdown);

		if (process.connected) {
			// wire up the graceful shutdown when running in debug mode
			process.on('message', msg => {
				if (msg === 'shutdown') {
					shutdown();
				}
			});

			// tell `appcd` we have booted successfully
			process.send('booted');
		}
	} catch (err) {
		if (err.code === 'EADDRINUSE') {
			process.send('already running');
		} else {
			console.error(err.stack);
		}
		process.exit(err.code && typeof err.code === 'number' ? err.code : 1);
	}
})();
