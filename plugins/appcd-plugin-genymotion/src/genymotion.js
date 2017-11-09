import path from 'path';

import { exe } from 'appcd-subprocess';
import { expandPath } from 'appcd-path';
import { getVirtualBox } from './virtualbox';
import { isDir, isFile } from 'appcd-fs';

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
			const p = path.join(dir, 'Contents', 'MacOS');
			if (isDir(p)) {
				dir = p;
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

		if (!Object.values(this.executables).every(cmd => isFile(cmd))) {
			throw new Error('Directory missing required program');
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
	 * Fetches the Genymotion version and installed emulators.
	 *
	 * @param {Object} vbox - Object containing information about the VirtualBox install
	 * @return {Object} - Stuff
	 */
	async init(vbox) {
		try {
			this.emulators = await getEmulators(vbox);
		} catch (e) {
			// squelch
		}
		return this;
	}
}

export async function getEmulators(vbox) {
	const emulators = [];
	const vms = await vbox.list();
	await Promise.all(vms.split(/\r?\n/).map(async vm => {
		const info = vm.trim().match(/^"(.+)" \{(.+)\}$/);
		if (!info) {
			return null;
		} else {
			vm = {
				name: info[1],
				guid: info[2],
			};
			const vminfo = await vbox.getVMInfo(vm.guid);
			if (vminfo) {
				for (const line of vminfo.split(/\r?\n/)) {
					const m = line.trim().match(/Name: (\S+), value: (\S*), timestamp:/);
					if (m) {
						switch (m[1]) {
							case 'android_version':
								vm['sdk-version'] = vm.target = m[2];
								break;
							case 'genymotion_player_version':
							case 'genymotion_version':
								vm.genymotion = m[2];
								break;
							case 'hardware_opengl':
								vm.hardwareOpenGL = !!parseInt(m[2]);
								break;
							case 'vbox_dpi':
								vm.dpi = ~~m[2];
								break;
							case 'vbox_graph_mode':
								vm.display = m[2];
								break;
							case 'androvm_ip_management':
								vm.ipaddress = m[2];
								break;
						}
					}
				}
				if (vm.genymotion) {
					vm.abi = 'x86';
					vm.googleApis = null; // null means maybe since we don't know for sure unless the emulator is running
					emulators.push(vm);
					return;
				}
			}
		}
	}));
	return emulators;
}

/**
 * Detect the Genymotion install, and emulators.
 * @param  {String} dir            The directory to scan.
 * @param  {Object} vbox VirtualBox install info.
 * @return {Stuff}                 Stuff.
 */
export async function detect(dir, vbox) {
	if (!vbox) {
		vbox = await getVirtualBox();
	}
	return await new Genymotion(dir).init(vbox);
}
