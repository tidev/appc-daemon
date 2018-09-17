/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

/**
 * The `winreg` module. This module is lazy loaded so that non-Windows platforms don't complain.
 * @type {Object}
 */
let Registry = null;

/**
 * Gets a key's value from the Windows registry.
 *
 * @param {String} hive - The hive to query. Must be "HKLM", "HKCU", "HKCR", "HKU", or "HKCC".
 * @param {String} key - The name of the registry key.
 * @param {String} name - The name of the registry value.
 * @returns {Promise} Resolves the key value.
 */
export async function get(hive, key, name) {
	const registry = await createRegistry(hive, key);
	if (registry === null) {
		return null;
	}

	if (typeof name !== 'string' || !name) {
		throw new TypeError('Expected name to be a non-empty string');
	}

	return new Promise((resolve, reject) => {
		registry.get(name, (err, item) => {
			if (err) {
				reject(err);
			} else {
				resolve(item && item.value || null);
			}
		});
	});
}

/**
 * Gets the subkeys for the specified key.
 *
 * @param {String} hive - The hive to query. Must be "HKLM", "HKCU", "HKCR", "HKU", or "HKCC".
 * @param {String} key - The name of the registry key.
 * @returns {Promise} Resolves an array of subkeys.
 */
export async function keys(hive, key) {
	const registry = await createRegistry(hive, key);
	if (registry === null) {
		return null;
	}

	return new Promise((resolve, reject) => {
		registry.keys((err, items) => {
			if (err) {
				reject(err);
			} else {
				resolve(items.map(item => item.key));
			}
		});
	});
}

/**
 * Initializes and validates a winreg call.
 *
 * @param {String} hive - The hive to query. Must be "HKLM", "HKCU", "HKCR", "HKU", or "HKCC".
 * @param {String} key - The name of the registry key.
 * @returns {Promise}
 */
async function createRegistry(hive, key) {
	const platform = process.env.APPCD_TEST_PLATFORM || process.platform;
	if (platform !== 'win32') {
		return null;
	}

	if (typeof hive !== 'string' || !hive) {
		throw new TypeError('Expected hive to be a non-empty string');
	}

	if (Registry === null) {
		Registry = require('winreg');
	}

	if (Registry.HIVES.indexOf(hive) === -1) {
		throw new Error(`Invalid hive "${hive}", must be "HKLM", "HKCU", "HKCR", "HKU", or "HKCC"`);
	}

	if (typeof key !== 'string' || !key) {
		throw new TypeError('Expected key to be a non-empty string');
	}

	if (!/^\\/.test(key)) {
		key = '\\' + key;
	}

	try {
		return new Registry({ hive, key });
	} catch (ex) {
		throw new Error(`winreg error: ${ex.message}`);
	}
}
