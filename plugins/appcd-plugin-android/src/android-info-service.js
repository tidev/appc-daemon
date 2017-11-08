import gawk from 'gawk';

import { DataServiceDispatcher } from 'appcd-dispatcher';

/**
 * The Android info service.
 */
export default class AndroidInfoService extends DataServiceDispatcher {
	/**
	 * Starts detecting Android information.
	 *
	 * @param {Config} cfg - An Appc Daemon config object.
	 * @returns {Promise}
	 * @access public
	 */
	async activate(cfg) {
		this.cfg = cfg;

		this.data = gawk({
			devices: [],
			emulators: [],
			ndk: [],
			sdk: []
		});
	}

	deactivate() {
		// nothing so far
	}
}
