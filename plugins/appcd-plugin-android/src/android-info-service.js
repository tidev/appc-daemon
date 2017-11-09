import DetectEngine from 'appcd-detect';
import gawk from 'gawk';

import * as androidlib from 'androidlib';

import { bat } from 'appcd-subprocess';
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

		await this.initDevices();
		await this.initNDKs();
		await this.initSDKsAndEmulators();
	}

	/**
	 * Returns a config setting using the dot-notation name.
	 *
	 * @param {String} name - The config setting name.
	 * @returns {*}
	 * @access private
	 */
	getConfig(name) {
		let obj = this.cfg;
		try {
			for (const key of name.split('.')) {
				obj = obj[key];
			}
		} catch (e) {
			return null;
		}
		return obj;
	}

	/**
	 * Initializes device tracking.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async initDevices() {
		// TODO
	}

	/**
	 * Wires up the Android NDK detect engine.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async initNDKs() {
		//
	}

	/**
	 * Wires up the Android SDK detect engine.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async initSDKsAndEmulators() {
		const paths = [ ...androidlib.sdk.sdkLocations[process.platform] ];
		const defaultPath = this.getConfig('android.sdkPath');
		if (defaultPath) {
			paths.unshift(defaultPath);
		}

		this.sdkDetectEngine = new DetectEngine({
			checkDir(dir) {
				try {
					return new androidlib.sdk.SDK(dir);
				} catch (e) {
					// 'dir' is not an SDK
				}
			},
			depth: 1,
			env: [ 'ANDROID_SDK', 'ANDROID_SDK_ROOT' ],
			exe: `android${bat}`,
			multiple: true,
			paths,
			// processResults: async (results, engine) => {
			//
			// },
			registryKeys: {
				hive: 'HKLM',
				key: 'Software\\Wow6432Node\\Android SDK Tools',
				name: 'Path'
			},
			redetect: true,
			watch: true
		});

		// listen for sdk results
		this.sdkDetectEngine.on('results', results => {
			gawk.set(this.data.sdk, results);
		});

		// if sdks change, then refresh the emulators
		gawk.watch(this.data.sdk, async (obj, src) => {
			// redetect emulators
			console.log('SDKs changed');
			console.log(src);
		});

		// detect the sdks which in turn will detect the emulators
		await this.sdkDetectEngine.start();
	}

	/**
	 * Stops the detect engines.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async deactivate() {
		if (this.sdkDetectEngine) {
			await this.sdkDetectEngine.stop();
			this.sdkDetectEngine = null;
		}
	}
}
