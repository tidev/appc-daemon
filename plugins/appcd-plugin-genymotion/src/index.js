/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import GenymotionInfoService from './genymotion-info-service';

const genymotionInfo = new GenymotionInfoService();

/**
 * Activates and wires up the Genymotion info service.
 *
 * @param {Config} cfg - An Appc Daemon config object
 * @returns {Promise}
 */
export async function activate(cfg) {
	await genymotionInfo.activate(cfg);
	appcd.register('/info', genymotionInfo);
}

/**
 * Shutdown the Genymotion info service.
 *
 * @returns {Promise}
 */
export async function deactivate() {
	await genymotionInfo.deactivate();
}
