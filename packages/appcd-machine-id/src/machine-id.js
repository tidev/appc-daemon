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
export default function getMachineId(midFile) {
	if (midFile) {
		if (typeof midFile !== 'string') {
			throw new TypeError('Expected midFile to be a string');
		}
		midFile = expandPath(midFile);
	}

	log('Detecting Machine ID...');

	return Promise.resolve()
		.then(() => {
			const platform = process.env.APPCD_TEST_PLATFORM || process.platform;

			if (platform === 'darwin') {
				return run('ioreg', [ '-ard1', '-c', 'IOPlatformExpertDevice' ])
					.then(result => {
						return import('simple-plist')
							.then(plist => {
								const json = plist.parse(result.stdout)[0];
								return json && sha1(json.IOPlatformUUID);
							});
					});
			}

			if (/^win/.test(platform)) {
				return get('HKLM', 'Software\\Microsoft\\Cryptography', 'MachineGuid')
					.then(result => {
						if (result) {
							return sha1(result);
						}
					});
			}
		})
		.catch(() => {}) // squelch errors
		.then(machineId => {
			if (machineId) {
				log('Native Machine ID: %s', highlight(machineId));
				return machineId;
			}

			// try to generate the machine id based on the mac address
			return import('macaddress')
				.then(macaddress => new Promise(resolve => {
					macaddress.one((err, mac) => {
						let machineId = null;
						if (!err && mac) {
							machineId = sha1(mac);
							log('MAC address Machine ID: %s', highlight(machineId));
						}
						resolve(machineId);
					});
				}));
		})
		.then(machineId => {
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
				fs.mkdirsSync(path.dirname(midFile));
				log('Writing Machine ID to %s', highlight(midFile));
				fs.writeFileSync(midFile, machineId);
			}

			return machineId;
		});
}
