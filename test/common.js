import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import snooplogg from 'snooplogg';
import tmp from 'tmp';

import { prepareNode } from 'appcd-nodejs';
import { spawn, spawnSync } from 'child_process';

const logger = snooplogg.config({
	minBrightness: 80,
	maxBrightness: 210,
	theme: 'detailed'
})('test');
const { log } = logger;
const { highlight } = snooplogg.styles;

export const testLogger = logger;
export { snooplogg };

export const defaultConfig = {
	environment: {
		name: 'test',
		title: 'Test'
	},
	plugins: {
		installDefault: false
	},
	telemetry: {
		environment: 'test'
	}
};

const appcdPath = path.resolve(__dirname, '..', 'packages', 'appcd', process.env.APPCD_COVERAGE ? 'src' : 'dist', 'main.js');
let isAppcdRunning = false;
export const coreNodeVersion = fs.readJsonSync(path.join(__dirname, '..', 'packages', 'appcd-core', 'package.json')).appcd.node;
let tmpNodePath = null;

const api = {
	symlinkPlugin(name, version) {
		const src = path.resolve(__dirname, '..', 'plugins', name);
		const dest = path.join(getAppcdHome(), 'plugins', 'packages', '@appcd', `plugin-${name}`, version);
		log(`Symlinking ${highlight(src)} => ${highlight(dest)}`);
		fs.ensureSymlinkSync(src, dest);
	},

	async installNode() {
		const dest = path.join(
			getAppcdHome(),
			'node',
			process.version,
			process.platform,
			process.arch, // technically this is not accurate, but good enough for tests
			path.basename(process.execPath)
		);

		if (tmpNodePath) {
			fs.ensureSymlinkSync(tmpNodePath, dest);
		} else if (process.versions.node === coreNodeVersion) {
			fs.ensureSymlinkSync(tmpNodePath = process.execPath, dest);
		} else {
			tmpNodePath = await prepareNode({
				nodeHome: makeTempDir(),
				version: coreNodeVersion
			});
			fs.ensureSymlinkSync(tmpNodePath, dest);
		}
	},

	async startDaemonDebugMode(cfg, output) {
		if (isAppcdRunning) {
			this.runAppcdSync([ 'stop' ]);
			isAppcdRunning = false;
		}

		const opts = {};
		if (!output) {
			opts.env = {
				...process.env,
				APPCD_TEST: '1'
			}
		}

		const child = this.runAppcd([ 'start', '--debug' ], opts, cfg);
		isAppcdRunning = true;

		const prom = new Promise((resolve, reject) => {
			child.stdout.on('data', data => {
				const s = data.toString();
				if (s.includes('Appc Daemon started')) {
					resolve(child);
				}
				if (output) {
					process.stdout.write(s);
				}
			});

			child.on('close', code => {
				isAppcdRunning = false;
				if (code) {
					reject(new Error(`appcd exited (code ${code})`));
				}
			});
		});

		if (output) {
			child.stderr.on('data', data => process.stdout.write(data.toString()));
		}

		await prom;
	},

	startDaemonSync(cfg) {
		if (isAppcdRunning) {
			this.runAppcdSync([ 'stop' ]);
			isAppcdRunning = false;
		}

		const result = this.runAppcdSync([ 'start' ], {}, cfg);
		isAppcdRunning = true;
		return result;
	},

	initHomeDir(fixture) {
		const appcdHome = path.join(os.homedir(), '.appcelerator', 'appcd');
		log(`Copying ${highlight(fixture)} => ${highlight(appcdHome)}`);
		fs.copySync(fixture, appcdHome);
	},

	runAppcd(args = [], opts = {}, cfg) {
		const env = { ...(opts.env || process.env) };
		if (env.APPCD_TEST) {
			delete env.SNOOPLOGG;
		}

		if (cfg) {
			args.unshift('--config', JSON.stringify(cfg));
		}

		log(`Executing: ${highlight(`${process.execPath} ${appcdPath} ${args.join(' ')}`)}`);
		return spawn(process.execPath, [ appcdPath, ...args ], {
			ignoreExitCodes: true,
			windowsHide: true,
			...opts,
			env
		});
	},

	runAppcdSync(args = [], opts = {},  cfg) {
		const env = { ...(opts.env || process.env) };
		if (env.APPCD_TEST) {
			delete env.SNOOPLOGG;
		}

		if (cfg) {
			args.unshift('--config', JSON.stringify(cfg));
		}

		log(`Executing: ${highlight(`${process.execPath} ${appcdPath} ${args.join(' ')}`)}`);
		const result = spawnSync(process.execPath, [ appcdPath, ...args ], {
			ignoreExitCodes: true,
			windowsHide: true,
			...opts,
			env
		});

		testLogger('stdout').log(result.stdout.toString());
		testLogger('stderr').log(result.stderr.toString());

		log(`Process exited (code ${result.status})`);
		return result;
	}
};

export function makeTest(fn) {
	return async () => {
		try {
			await fn.call(api);
		} finally {
			api.runAppcdSync([ 'stop' ]);
			emptyHomeDir();
		}
	};
}

export function makeTempName(prefix = 'appcd-test-') {
	const { name } = tmp.dirSync({
		mode: '755',
		prefix,
		unsafeCleanup: true
	});
	return path.join(name, Math.random().toString(36).substring(7));
}

export function makeTempDir(prefix) {
	const dir = makeTempName(prefix);
	fs.mkdirsSync(dir);
	return dir;
}

export function emptyHomeDir() {
	// sanity check that we're not nuking the real home directory
	const homedir = os.homedir();
	if (!/[\\\/]home|users/i.test(homedir) && homedir.startsWith(os.tmpdir())) {
		for (const name of fs.readdirSync(homedir)) {
			fs.removeSync(path.join(homedir, name));
		}
	}
}

export function getAppcdHome() {
	return path.join(os.homedir(), '.appcelerator', 'appcd');
}

export function stripColors(s) {
	return s.replace(/\x1B\[\d+m/g, '');
}
