import path from 'path';

import { cache, sleep } from 'appcd-util';
import { expandPath } from 'appcd-path';
import { exe, run } from 'appcd-subprocess';
import { isDir, isFile } from 'appcd-fs';
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
	 * @param  {String} dir Directory to scan.
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
		this.version = null;

		if (!Object.values(this.executables).every(cmd => isFile(cmd))) {
			throw new Error('Directory does not contain vboxmanage executable');
		}

		const { status, stdout } = spawnSync(this.executables.vboxmanage, [ '-version' ]);

		if (status === 0) {
			this.version = stdout.toString().split('\n')[0].trim();
		}
	}

	/**
	 * List all VirtualBox VMs
	 *
	 * @async
	 * @return {Promise<String|null>} - The output of the list vms command, or null if command errored
	 */
	async list() {
		try {
			const { stdout } = await run(this.executables.vboxmanage, [ 'list', 'vms' ]);
			return stdout.trim();
		} catch (e) {
			return null;
		}
	}

	/**
	 * Query the guestproperties of a VM
	 * @param  {String}  guid - The guid for the VirtualBox VM
	 * @return {Promise<String|null>} - The output of the command, or null if command errored
	 */
	async getVMInfo(guid) {
		try {
			const { stdout } = await run(this.executables.vboxmanage, [ 'guestproperty', 'enumerate', guid ]);
			return stdout.trim();
		} catch (e) {
			return null;
		}
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
