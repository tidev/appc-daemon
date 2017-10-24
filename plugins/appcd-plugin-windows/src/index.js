/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import WindowsInfoService from './windows-info-service';

const windowsInfo = new WindowsInfoService();

/**
 * Activates and wires up the Windows environment info service.
 *
 * @param {Config} cfg - An Appc Daemon config object
 * @returns {Promise}
 */
export async function activate(cfg) {
	await windowsInfo.activate(cfg);
	appcd.register('/info', windowsInfo);
}

/**
 * Shutdown the Windows info service.
 *
 * @returns {Promise}
 */
export async function deactivate() {
	await windowsInfo.deactivate();
}
