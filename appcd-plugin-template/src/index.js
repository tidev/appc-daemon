/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

/**
 * Wires up plugin services.
 *
 * @param {Config} cfg - An Appc Daemon config object
 * @returns {Promise}
 */
export async function activate(cfg) {
	//
}

/**
 * Shuts down plugin services.
 *
 * @returns {Promise}
 */
export async function deactivate() {
	//
}
