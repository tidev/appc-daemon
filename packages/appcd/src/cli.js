/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import CLI from 'cli-kit';
import start from './start';
import stop from './stop';
import restart from './restart';
import config from './config';
import exec from './exec';
import logcat from './logcat';
import status from './status';

import { getAppcdVersion } from './common';

new CLI({
	commands: {
		start,
		stop,
		restart,
		config,
		exec,
		logcat,
		status
	},
	help: true,
	helpExitCode: 2,
	name: 'appcd',
	options: {
		'--config <json>':      { type: 'json', desc: 'serialized JSON string to mix into the appcd config' },
		'--config-file <file>': { type: 'file', desc: 'path to a appcd JS config file' }
	},
	version: getAppcdVersion()
}).exec()
	.catch(err => {
		console.error(err.message);
		process.exit(err.exitCode || 1);
	});
