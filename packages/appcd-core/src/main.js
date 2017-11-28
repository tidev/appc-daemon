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

process
	.on('uncaughtException', err => logger.error('Caught unhandled exception:', err))
	.on('unhandledRejection', (reason, p) => logger.error('Caught unhandled rejection at: Promise ', p, reason));

new CLI({
	options: {
		'--config <json>':      { type: 'json', desc: 'serialized JSON string to mix into the appcd config' },
		'--config-file <file>': { type: 'file', desc: 'path to a config file to use instead of the user config file' }
	},
	help: false
}).exec()
	.then(({ argv }) => {
		return import('./server')
			.then(server => new server.default(argv))
			.then(server => server.start())
			.then(() => {
				if (process.connected) {
					process.send('booted');
				}
			});
	})
	.catch(err => {
		if (err.code === 'EADDRINUSE') {
			process.send('already running');
		} else {
			console.error(err);
		}
		process.exit(err.code && typeof err.code === 'number' ? err.code : 1);
	});
