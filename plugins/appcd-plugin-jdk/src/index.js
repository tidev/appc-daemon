import JDKInfoService from './jdk-info-service';

const jdkInfo = new JDKInfoService();

/**
 * Activates and wires up the JDK info service.
 *
 * @param {Config} cfg - An Appc Daemon config object
 * @returns {Promise}
 */
export async function activate(cfg) {
	await jdkInfo.activate(cfg);
	appcd.register('/info', jdkInfo);
}

/**
 * Shutdown the JDK info service.
 *
 * @returns {Promise}
 */
export async function deactivate() {
	await jdkInfo.deactivate();
}
