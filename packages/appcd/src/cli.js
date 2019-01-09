import appcdLogger from 'appcd-logger';
import CLI from 'cli-kit';
import config from './commands/config';
import dump from './commands/dump';
import exec from './commands/exec';
import logcat from './commands/logcat';
import restart from './commands/restart';
import start from './commands/start';
import status from './commands/status';
import stop from './commands/stop';

import { getAppcdVersion } from './common';

const version = getAppcdVersion();

let banner;
if (!process.env.hasOwnProperty('APPC_NPM_VERSION')) {
	banner = `${appcdLogger.styles.highlight('Appcelerator Daemon')}, version ${version}\n`
		+ 'Copyright (c) 2015-2019, Axway, Inc. All Rights Reserved.';
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
	desc: 'The Appc Daemon is a local server that runs in the background and hosts services which power the tooling for Axway products such as Axway Titanium SDK.',
	help: true,
	helpExitCode: 2,
	name: 'appcd',
	options: {
		'--config <json>':      { type: 'json', desc: 'serialized JSON string to mix into the appcd config' },
		'--config-file <file>': { type: 'file', desc: 'path to a appcd JS config file' }
	},
	version
});
