import CLI from 'cli-kit';
import config from './config';
import dump from './dump';
import exec from './exec';
import logcat from './logcat';
import restart from './restart';
import start from './start';
import status from './status';
import stop from './stop';

import { getAppcdVersion } from './common';

export default new CLI({
	commands: {
		config,
		dump,
		exec,
		logcat,
		restart,
		start,
		status,
		stop
	},
	help: true,
	helpExitCode: 2,
	name: 'appcd',
	options: {
		'--config <json>':      { type: 'json', desc: 'serialized JSON string to mix into the appcd config' },
		'--config-file <file>': { type: 'file', desc: 'path to a appcd JS config file' },
		'--no-colors':          { type: 'bool', desc: 'disables colors' }
	},
	version: getAppcdVersion()
});
