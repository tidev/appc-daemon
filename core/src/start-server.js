import { Server } from './index';

/**
 * This file is the entry point for when appcd daemonizes. This file can be
 * overwritten with the 'appcd.startScript' config setting.
 */

const p = process.argv.indexOf('--config-file');
let configFile = p !== -1 && process.argv.length > p ? process.argv[p + 1] : null;

new Server({
	appcd: {
		allowExit: false,
		configFile,
		daemonize: process.argv.includes('--daemonize')
	}
}).start();
