import { debounce } from 'appcd-util';

export default class RegistryWatcher {
	/**
	 * ?
	 *
	 * @param {Object} params - ?
	 * @param {Array.<Object>} params.keys - ?
	 * @param {Function} params.callback - ?
	 * @param {DetectEngine} engine - ?
	 * @access public
	 */
	constructor({ keys, callback }, engine) {
		this.engine = engine;

		for (const { key, value, filter, callback } of keys) {
			//
		}
	}

	destroy() {
		this.engine = null;
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
