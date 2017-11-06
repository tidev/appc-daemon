/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import iOSInfoService from './ios-info-service';

const iosInfo = new iOSInfoService();

/**
 * Activates and wires up the iOS info service.
 *
 * @param {Config} cfg - An Appc Daemon config object
 * @returns {Promise}
 */
export async function activate(cfg) {
	await iosInfo.activate(cfg);
	appcd.register('/info', iosInfo);
}

/**
 * Shutdown the iOS info service.
 *
 * @returns {Promise}
 */
export async function deactivate() {
	await iosInfo.deactivate();
}
