/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import path from 'path';

import { isDir, isFile } from 'appcd-fs';
import { expandPath, real } from 'appcd-path';
import { exe, run } from 'appcd-subprocess';

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

		console.log(`Found a Genymotion install, but need to init: ${dir}`);
	}

	/**
	 * Fetches the Genymotion version and installed emulators
	 */
	async init(vboxmanage) {
		try {
			const { stdout } = await run(vboxmanage, [ 'list', 'vms' ]);
			stdout.split('\n').forEach(async vm => {
				vm = vm.trim();
				console.log(vm);
				const match = vm.match(/^"(.+)" \{(.+)\}$/);
				if (!match) {
					return;
				}
				let emu = {
					name: match[1],
					guid: match[2],
					type: 'genymotion',
					abi: 'x86',
					googleApis: null, // null means maybe since we don't know for sure unless the emulator is running
					'sdk-version': null
				};
				const { stdout } = await run(vboxmanage, [ 'guestproperty', 'enumerate', emu.guid ]);
				stdout.split('\n').forEach(line => {
					const m = line.trim().match(/Name: (\S+), value: (\S*), timestamp:/);
					if (m) {
						switch (m[1]) {
							case 'android_version':
								emu['sdk-version'] = emu.target = m[2];
								break;
							case 'genymotion_version':
								emu.genymotion = m[2];
								break;
							case 'hardware_opengl':
								emu.hardwareOpenGL = !!parseInt(m[2]);
								break;
							case 'vbox_dpi':
								emu.dpi = ~~m[2];
								break;
							case 'vbox_graph_mode':
								emu.display = m[2];
								break;
							case 'androvm_ip_management':
								emu.ipaddress = m[2];
								break;
						}
					}
				});
				if (emu.genymotion) {
					console.log(emu);
					this.emulators.push(emu);
				}
			});
		} catch (e) {

		}
		return this;
	}
}

export async function detect(dir, vboxmanage) {
	return await new Genymotion(dir).init(vboxmanage);
}
