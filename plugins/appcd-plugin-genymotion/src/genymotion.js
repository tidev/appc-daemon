/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import path from 'path';

import { isDir, isFile } from 'appcd-fs';
import { expandPath } from 'appcd-path';
import { exe } from 'appcd-subprocess';

import { getVirtualBox, VirtualBoxExe } from './virtualbox';

export const genymotionLocations = {
	darwin: [
		'/Applications/Genymotion.app/Contents',
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
		'%AppData%/Local/Genymobile/Genymotion'
	]
};

/**
 * Genymotion information
 */
export class Genymotion {

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
			this.executables.player = path.join(dir, 'player');
		}

		if (!Object.values(this.executables).every(cmd => isFile(cmd))) {
			throw new Error('Directory missing required program');
		}

		const homeDirs = genymotionHomeLocations[process.platform];
		for (const homeDir of homeDirs) {
			if (isDir(expandPath(homeDir))) {
				this.home = expandPath(homeDir);
				break;
			}
		}

		if (!this.home) {
			throw new Error('Unable to find Genymotion home directory');
		}

		console.log(`Found a Genymotion install, but need to init: ${dir}`);
	}

	/**
	 * Fetches the Genymotion version and installed emulators
	 */
	async init(virtualBoxInfo) {
		try {
			this.emulators = await getEmulators(virtualBoxInfo);
		} catch (e) {
			// squelch
		}
		return this;
	}
}

export async function getEmulators(virtualBoxInfo) {
	const vboxmanage = virtualBoxInfo.executables.vboxmanage;
	let emulators = [];

	const vbox = new VirtualBoxExe(vboxmanage);
	const vms = await vbox.list();
	const vminfos = await Promise.all(vms.split('\n').map(async vm => {
		const info = vm.trim().match(/^"(.+)" \{(.+)\}$/);
		if (!info) {
			return null;
		} else {
			return {
				name: info[1],
				guid: info[2],
			};
		}
	}));
	emulators = await Promise.all(vminfos.map(async vm => {
		const info = await vbox.vmInfo(vm.guid);
		if (info) {
			info.split('\n').forEach(line => {
				const m = line.trim().match(/Name: (\S+), value: (\S*), timestamp:/);
				if (m) {
					switch (m[1]) {
						case 'android_version':
							vm['sdk-version'] = vm.target = m[2];
							break;
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
			});
			if (vm.genymotion) {
				vm.abi = 'x86';
				vm.googleApis = null; // null means maybe since we don't know for sure unless the emulator is running
			}
			return vm;
		}
	}));
	return emulators.filter(emu => emu.genymotion);
}

export async function detect(dir, virtualBoxInfo) {
	if (!virtualBoxInfo) {
		virtualBoxInfo = await getVirtualBox();
	}
	return await new Genymotion(dir).init(virtualBoxInfo);
}
