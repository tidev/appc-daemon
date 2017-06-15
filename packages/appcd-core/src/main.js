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

import 'babel-polyfill';

import CLI from 'cli-kit';
import snooplogg from './logger';

process
	.on('uncaughtException', err => snooplogg.error('Caught exception:', err))
	.on('unhandledRejection', (reason, p) => snooplogg.error('Unhandled Rejection at: Promise ', p, reason));

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
			.then(server => server.start());
	})
	.catch(err => {
		console.error(err);
		process.exit(err.code || 1);
	});
