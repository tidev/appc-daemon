if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import fs from 'fs-extra';
import path from 'path';
import snooplogg, { styles } from 'snooplogg';

import { expandPath } from 'appcd-path';
import { isFile } from 'appcd-fs';
import { randomBytes, sha1 } from 'appcd-util';
import { run } from 'appcd-subprocess';

const logger = snooplogg.config({ theme: 'detailed' })('appcd:machine-id');

/**
 * Determines and caches a unique machine identifier.
 *
 * @param {String} [midFile] - The path to the file to cache the machine id.
 * @returns {Promise} Resovles the machine id.
 */
export function getMachineId(midFile) {
	if (midFile) {
		if (typeof midFile !== 'string') {
			throw new TypeError('Expected midFile to be a string');
		}
		midFile = expandPath(midFile);
	}

	logger.log('Detecting Machine ID...');

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
				return run('reg', [ 'query', 'HKLM\\Software\\Microsoft\\Cryptography', '/v', 'MachineGuid' ])
					.then(result => {
						const m = result.stdout.trim().match(/MachineGuid\s+REG_SZ\s+(.+)/i);
						if (m) {
							return sha1(m[1]);
						}
					});
			}
		})
		.catch(err => Promise.resolve()) // squeltch errors
		.then(machineId => {
			if (machineId) {
				logger.log('Native Machine ID: %s', styles.highlight(machineId));
				return machineId;
			}

			// try to generate the machine id based on the mac address
			return import('macaddress')
				.then(macaddress => new Promise((resolve, reject) => {
					macaddress.one((err, mac) => {
						let machineId = null;
						if (!err && mac) {
							machineId = sha1(mac);
							logger.log('MAC address Machine ID: %s', styles.highlight(machineId));
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

			logger.log('Machine ID: %s', styles.highlight(machineId));

			// write the mid file
			if (midFile) {
				fs.mkdirsSync(path.dirname(midFile));
				logger.log('Writing Machine ID to %s', styles.highlight(midFile));
				fs.writeFileSync(midFile, machineId);
			}

			return machineId;
		});
}
