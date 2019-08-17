import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import tmp from 'tmp';
import { spawn, spawnSync } from 'child_process';

const appcdPath = path.resolve(__dirname, '..', 'packages', 'appcd', process.env.APPCD_COVERAGE ? 'src' : 'dist', 'main.js');

export function runAppcd(args = [], opts = {}) {
	return spawn(process.execPath, [ appcdPath, ...args ], {
		ignoreExitCodes: true,
		windowsHide: true,
		...opts
	});
}

export function runAppcdSync(args = [], opts = {}) {
	// console.log(`Executing: ${process.execPath} ${appcdPath} ${args.join(' ')}`);
	return spawnSync(process.execPath, [ appcdPath, ...args ], {
		ignoreExitCodes: true,
		windowsHide: true,
		...opts
	});
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
	if (!/home|users/i.test(homedir) && homedir.startsWith(os.tmpdir())) {
		for (const name of fs.readdirSync(homedir)) {
			fs.removeSync(path.join(homedir, name));
		}
	}
}
