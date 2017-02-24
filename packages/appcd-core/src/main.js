if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import 'babel-polyfill';

import CLI from 'cli-kit';

import { assertNodeEngineVersion } from 'appcd-util';
import snooplogg from './logger';

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
	.then(appcd => {
		Object.defineProperty(global, 'appcd', {
			configurable: false,
			enumerable: true,
			value: appcd
		});
	})
	.catch(console.error);
