import path from 'path';

import { cache } from 'appcd-util';
import { expandPath } from 'appcd-path';
import { exe, run } from 'appcd-subprocess';
import { isDir, isFile } from 'appcd-fs';
import { spawnSync } from 'child_process';

/**
 * Common VirtualBox install locations
 * @type {Object}
 */
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

const VM_INFO_REGEX = /^"(.+)" \{(.+)\}$/;
const GUESTPROPERTY_REGEX = /Name: (\S+), value: (\S*), timestamp:/;

/**
 * VirtualBox information
 */
export class VirtualBox {
	/**
	 * Performs tests to see if this is a VirtualBox install directory,
	 * and then initializes the info.
	 *
	 * @param {String} dir - Directory to scan.
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

		if (!isFile(this.executables.vboxmanage)) {
			throw new Error('Directory does not contain vboxmanage executable');
		}

		const { status, stdout } = spawnSync(this.executables.vboxmanage, [ '-version' ]);

		if (status === 0) {
			this.version = stdout.toString().split('\n')[0].trim();
		}
	}

	/**
	 * List all VirtualBox VMs.
	 *
	 * @return {Promise<Array.<Object>|null>} - Array of VM objects with guid and name, or null if command errored.
	 */
	async list() {
		try {
			const { stdout } = await run(this.executables.vboxmanage, [ 'list', 'vms' ]);
			const vms = [];
			for (const vm of stdout.trim().split(/\r?\n/)) {
				const info = VM_INFO_REGEX.exec(vm);
				if (info) {
					vms.push({
						name: info[1],
						guid: info[2],
					});
				}
			}
			return vms;
		} catch (e) {
			return null;
		}
	}

	/**
	 * Query the guestproperties of a VM.
	 *
	 * @param {String}  guid - The guid for the VirtualBox VM.
	 * @return {Promise<Array.<Object>|null>} - Array of guestproperty objects with name and value,
	 * or null if command errored.
	 */
	async getGuestproperties(guid) {
		try {
			const { stdout } = await run(this.executables.vboxmanage, [ 'guestproperty', 'enumerate', guid ]);
			const properties = [];
			for (const guestproperty of stdout.trim().split(/\r?\n/)) {
				const propertyInfo = GUESTPROPERTY_REGEX.exec(guestproperty);
				if (propertyInfo) {
					properties.push({
						name: propertyInfo[1],
						value: propertyInfo[2]
					});
				}
			}
			return properties;
		} catch (e) {
			return null;
		}
	}
}

/**
 * Detect installations of VirtualBox.
 *
 * @param {Boolean} force - Force function to be ran.
 * @return {Promise<VirtualBox>}
 */
export function getVirtualBox(force) {
	return cache('virtualbox', force, async () => {
		for (let dir of virtualBoxLocations[process.platform]) {
			dir = expandPath(dir);
			try {
				return new VirtualBox(dir);
			} catch (e) {
				// blah
			}
		}
	});
}
