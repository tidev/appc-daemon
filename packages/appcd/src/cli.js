import appcdLogger from 'appcd-logger';
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

const version = getAppcdVersion();

let banner;
if (!process.env.hasOwnProperty('APPC_NPM_VERSION')) {
	banner = `${appcdLogger.styles.highlight('Appcelerator Daemon')}, version ${version}\n`
		+ 'Copyright (c) 2015-2018, Axway, Inc. All Rights Reserved.';
}

export default new CLI({
	banner,
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
		'--config-file <file>': { type: 'file', desc: 'path to a appcd JS config file' }
	},
	version
});
