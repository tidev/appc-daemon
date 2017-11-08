/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import AndroidInfoService from './android-info-service';

const androidInfo = new AndroidInfoService();

/**
 * Activates and wires up the Android info service.
 *
 * @param {Config} cfg - An Appc Daemon config object
 * @returns {Promise}
 */
export async function activate(cfg) {
	await androidInfo.activate(cfg);
	appcd.register('/info', androidInfo);
}

/**
 * Shutdown the Android info service.
 *
 * @returns {Promise}
 */
export async function deactivate() {
	await androidInfo.deactivate();
}
