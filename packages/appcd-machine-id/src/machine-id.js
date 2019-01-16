/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import appcdLogger from 'appcd-logger';
import fs from 'fs-extra';
import path from 'path';

import { expandPath } from 'appcd-path';
import { isFile } from 'appcd-fs';
import { randomBytes, sha1 } from 'appcd-util';
import { run } from 'appcd-subprocess';
import { get } from 'appcd-winreg';

const { log } = appcdLogger.config({ theme: 'detailed' })('appcd:machine-id');
const { highlight } = appcdLogger.styles;

/**
 * Determines and caches a unique machine identifier.
 *
 * @param {String} [midFile] - The path to the file to cache the machine id.
 * @returns {Promise} Resolves the machine id.
 */
export default async function getMachineId(midFile) {
	if (midFile) {
		if (typeof midFile !== 'string') {
			throw new TypeError('Expected midFile to be a string');
		}
		midFile = expandPath(midFile);
	}

	log('Detecting Machine ID...');

	const platform = process.env.APPCD_TEST_PLATFORM || process.platform;
	let machineId = null;

	try {
		if (platform === 'darwin') {
			const result = await run('ioreg', [ '-ard1', '-c', 'IOPlatformExpertDevice' ]);
			const plist = await import('simple-plist');
			const json = plist.parse(result.stdout)[0];
			if (json) {
				machineId = sha1(json.IOPlatformUUID);
			}
		} else if (/^win/.test(platform)) {
			const result = await get('HKLM', 'Software\\Microsoft\\Cryptography', 'MachineGuid');
			if (result) {
				machineId = sha1(result);
			}
		}

		if (machineId) {
			log('Native Machine ID: %s', highlight(machineId));
		} else {
			// try to generate the machine id based on the mac address
			const macaddress = await import('macaddress');
			machineId = await new Promise(resolve => {
				macaddress.one((err, mac) => {
					resolve(!err && mac ? sha1(mac) : null);
				});
			});
			if (machineId) {
				log('MAC address Machine ID: %s', highlight(machineId));
			}
		}
	} catch (err) {
		// squelch
	}

	if (!machineId) {
		// see if we have a cached machine id
		if (midFile && isFile(midFile)) {
			machineId = fs.readFileSync(midFile, 'utf8').split('\n')[0];
			if (!machineId || machineId.length !== 40) {
				machineId = null;
			}
		}
	}

	// generate a random machine id
	if (!machineId) {
		machineId = randomBytes(20);
	}

	log('Machine ID: %s', highlight(machineId));

	// write the mid file
	if (midFile) {
		await fs.mkdirs(path.dirname(midFile));
		log('Writing Machine ID to %s', highlight(midFile));
		fs.writeFileSync(midFile, machineId);
	}

	return machineId;
}
