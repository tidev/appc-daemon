import { debounce } from 'appcd-util';

export default class RegistryWatcher {
	/**
	 * A reference to the `winreglib` module. Only available on Windows machines.
	 * @type {Object}
	 */
	winreglib = process.platform === 'win32' ? require('winreglib') : null;

	/**
	 * ?
	 *
	 * @param {Array.<Object>} keys - ?
	 * @param {Function} callback - ?
	 * @access public
	 */
	constructor(keys, callback) {
		// for (const { key, value, filter, callback } of keys) {
		// 	//
		// }
	}

	stop() {
		//
	}
}

// const onChange = debounce(async () => {
// 	await this.rescan();
// });
// keys
// - key
// - value
// - filter
// - callback
// callback
