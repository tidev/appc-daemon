if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import CLI from 'cli-kit';
import start from './start';
import stop from './stop';
import restart from './restart';
import exec from './exec';
import logcat from './logcat';
import status from './status';

new CLI({
	commands: {
		start,
		stop,
		restart,
		exec,
		logcat,
		status
	},
	options: {
		'--config <json>':      { type: 'json', desc: 'serialized JSON string to mix into the appcd config' },
		'--config-file <file>': { type: 'file', desc: 'path to a appcd JS config file' },
	}
}).exec()
	.catch(console.error);
