if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import 'babel-polyfill';

import CLI from 'cli-kit';

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
		const Server = require('./server').default;
		global.appcd = new Server(argv).start();
	})
	.catch(console.error);
