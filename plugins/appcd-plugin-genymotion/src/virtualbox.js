/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import path from 'path';

import { cache, sleep } from 'appcd-util';
import { isDir, isFile } from 'appcd-fs';
import { expandPath } from 'appcd-path';
import { exe, run } from 'appcd-subprocess';
import { spawnSync } from 'child_process';

export const virtualBoxLocations = {
	darwin: [
		'/usr/local/bin'
	],
	linux: [
		'/opt',
		'/opt/local',
		'/usr',
		'/usr/local',
		'~'
	],
	win32: [
		'%ProgramFiles%\\Oracle\\VirtualBox',
		'%ProgramFiles(x86)%\\Oracle\\VirtualBox',
	]
};

/**
 * Genymotion information
 */
export class VirtualBox {

	/**
	 * Performs tests to see if this is a Genymotion install directory,
	 * and then initializes the info.
	 * @param  {String} dir Directory to scan
	 * @access public
	 */
	constructor(dir) {
		if (typeof dir !== 'string' || !dir) {
			throw new TypeError('Expected directory to be a valid string');
		}

		dir = expandPath(dir);
		if (!isDir(dir)) {
			throw new Error('Directory does not exist');
		}

		this.executables = {
			vboxmanage: path.join(dir, `vboxmanage${exe}`)
		};
		this.version	 = null;

		if (!Object.values(this.executables).every(cmd => isFile(cmd))) {
			throw new Error('Directory does not contain vboxmanage executable');
		}

		const { status, stdout } = spawnSync(this.executables.vboxmanage, [ '-version' ]);

		if (status === 0) {
			this.version = stdout.toString().split('\n')[0].trim();
		} else {
			console.log('Unable to get VirtualBox version');
		}
	}
}

export class VirtualBoxExe {
	constructor(bin) {
		this.bin = bin;
	}

	async list() {
		return this.tryVbox([ 'list', 'vms' ])
			.then(output => {
				return output;
			});
	}

	vmInfo(guid) {
		return this.tryVbox([ 'guestproperty', 'enumerate', guid ])
			.then(output => {
				return output;
			});
	}

	tryVbox(args, maxTries) {
		let timeout = 100;

		const attempt = async (remainingTries) => {
			if (remainingTries < 0) {
				throw new Error('Failed to run vbox');
			}

			try {
				const { stdout } = await run(this.bin, args);
				return stdout.trim();
			} catch (e) {

				await sleep(timeout);
				timeout *= 2;

				return attempt(remainingTries - 1);
			}
		};

		return attempt(Math.max(maxTries || 4, 1));
	}
}

export function getVirtualBox(force) {
	return cache('virtualbox', force, async () => {
		let virtualbox;
		for (let dir of virtualBoxLocations[process.platform]) {
			dir = expandPath(dir);
			try {
				virtualbox = new VirtualBox(dir);
			} catch (e) {
				// blah
			}
		}
		return virtualbox;
	});
}
