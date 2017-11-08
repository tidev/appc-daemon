/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import path from 'path';

import { isDir, isFile } from 'appcd-fs';
import { expandPath, real } from 'appcd-path';
import { exe, run } from 'appcd-subprocess';

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
		'%SystemDrive%',
		'%ProgramFiles%',
		'%ProgramFiles(x86)%',
		'~'
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

		console.log(`Found a VirtualBox install, but need to init: ${dir}`);
	}

	/**
	 * Fetches the Genymotion version and installed emulators
	 */
	async init() {
		const vboxManage = this.executables.vboxmanage;
		try {
			const { stdout } = await run(vboxManage, [ '-version' ]);
			this.version = stdout.split('\n')[0].trim();
		} catch (err) {
			console.log('Failed to get VirtualBox version', err);
		}
		return this;
	}
}

export async function detect(dir) {
	return await new VirtualBox(dir).init();
}
