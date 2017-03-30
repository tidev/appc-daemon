if (module.parent) {
	throw new Error('appcd-core is meant to be run directly, not require()\'d');
}

if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import 'babel-polyfill';

import CLI from 'cli-kit';
import snooplogg from './logger';

import { assertNodeEngineVersion } from 'appcd-util';

assertNodeEngineVersion(`${__dirname}/../package.json`);

new CLI({
	options: {
		'--config <json>':      { type: 'json', desc: 'serialized JSON string to mix into the appcd config' },
		'--config-file <file>': { type: 'file', desc: 'path to a appcd JS config file' }
	},
	help: false
}).exec()
	.then(({ argv }) => {
		return import('./server')
			.then(server => new server.default(argv));
	})
	.then(server => server.start())
	.catch(console.error);
