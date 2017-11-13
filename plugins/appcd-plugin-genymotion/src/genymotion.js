import path from 'path';

import { exe } from 'appcd-subprocess';
import { expandPath } from 'appcd-path';
import { getVirtualBox } from './virtualbox';
import { isDir, isFile } from 'appcd-fs';

/**
 * Common Genymotion install locations
 * @type {Object}
 */
export const genymotionLocations = {
	darwin: [
		'/Applications/Genymotion.app/',
		'~/Applications/Genymotion.app/'
	],
	linux: [
		'/opt',
		'/usr',
		'~'
	],
	win32: [
		'%ProgramFiles%\\Genymobile\\Genymotion',
		'%ProgramFiles%\\Genymotion',
		'%ProgramFiles(x86)%\\Genymobile\\Genymotion',
		'%ProgramFiles(x86)%\\Genymotion'
	]
};

/**
 * Common Genymotion home directory locations
 * @type {Object}
 */
export const genymotionHomeLocations = {
	darwin: [
		'~/.Genymobile/Genymotion',
		'~/.Genymotion'
	],
	linux : [
		'~/.Genymobile/Genymotion',
		'~/.Genymotion'
	],
	win32: [
		'%LocalAppData%/Genymobile/Genymotion'
	]
};

/**
 * Genymotion information
 */
export class Genymotion {
	/**
	 * Performs tests to see if this is a Genymotion install directory,
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

		// on OS X, it lives in Contents/MacOS
		if (process.platform === 'darwin') {
			let p = path.join(dir, 'Contents', 'MacOS');
			if (isDir(p)) {
				dir = p;
			} else {
				p = path.join(dir, '..', 'Contents', 'MacOS');
				if (isDir(p)) {
					dir = p;
				}
			}
		}

		this.emulators 	 = [];
		this.executables = {};
		this.home 		 = null;
		this.path 		 = dir;

		this.executables.genymotion = path.join(dir, `genymotion${exe}`);

		if (process.platform === 'darwin') {
			this.executables.player = path.join(dir, 'player.app', 'Contents', 'MacOS', 'player');
		} else {
			this.executables.player = path.join(dir, `player${exe}`);
		}

		for (const name of Object.keys(this.executables)) {
			if (!isFile(this.executables[name])) {
				throw new Error(`Directory does not contain the "${name}" executable`);
			}
		}

		const homeDirs = genymotionHomeLocations[process.platform];
		for (let homeDir of homeDirs) {
			homeDir = expandPath(homeDir);
			if (isDir(homeDir)) {
				this.home = homeDir;
				break;
			}
		}

		if (!this.home) {
			throw new Error('Unable to find Genymotion home directory');
		}
	}

	/**
	 * Get the Genymotion emulators installed on a system.
	 *
	 * @param  {Object} vbox - Object containing information about the VirtualBox install.
	 * @return {Array<Object>} The installed emulators.
	 */
	async getEmulators(vbox) {
		if (!vbox) {
			return;
		}
		this.emulators = [];
		const vms = await vbox.list();
		await Promise.all(vms.map(async vm => {
			Object.assign(vm, await this.getEmulatorInfo(vm.guid, vbox));
			if (vm.genymotion) {
				this.emulators.push(vm);
			}
			return;
		}));

		return this.emulators;
	}

	/**
	 * Get the information for a specific vm.
	 * @param  {String}  guid - The VM guid.
	 * @param  {Object}  vbox - Object containing information about the VirtualBox install.
	 * @return {Promise<Object>} Object containing information about the VM
	 */
	async getEmulatorInfo(guid, vbox) {
		if (!guid) {
			return new TypeError('Guid must be a string');
		}
		if (!vbox) {
			return;
		}
		const emulator = {};
		const vminfo = await vbox.getGuestproperties(guid);
		for (const info of vminfo) {
			switch (info.name) {
				case 'android_version':
					emulator['sdk-version'] = emulator.target = info.value;
					break;
				case 'genymotion_player_version':
				case 'genymotion_version':
					emulator.genymotion = info.value;
					break;
				case 'hardware_opengl':
					emulator.hardwareOpenGL = !!parseInt(info.value);
					break;
				case 'vbox_dpi':
					emulator.dpi = ~~info.value;
					break;
				case 'vbox_graph_mode':
					emulator.display = info.value;
					break;
				case 'androvm_ip_management':
					emulator.ipaddress = info.value;
					break;
			}
		}
		if (emulator.genymotion) {
			emulator.abi = 'x86';
			emulator.googleApis = null; // null means maybe since we don't know for sure unless the emulator is running
			return emulator;
		}
	}
}

/**
 * Detect the Genymotion install, and emulators.
 *
 * @param {String} dir - The directory to scan.
 * @param {Object} vbox - VirtualBox install info.
 * @return {Promise} A Genymotion instance
 */
export async function detect(dir, vbox) {
	return await new Genymotion(dir).init(vbox);
}
