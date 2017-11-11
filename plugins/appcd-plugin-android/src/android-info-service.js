import DetectEngine from 'appcd-detect';
import gawk from 'gawk';

import * as androidlib from 'androidlib';

import { bat, cmd, exe } from 'appcd-subprocess';
import { DataServiceDispatcher } from 'appcd-dispatcher';
import { get, mergeDeep } from 'appcd-util';

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
		this.config = cfg;

		this.data = gawk({
			devices: [],
			emulators: [],
			ndk: [],
			sdk: []
		});

		if (cfg.android) {
			mergeDeep(androidlib.options, cfg.android);
		}

		await this.initDevices();
		await this.initNDKs();
		await this.initSDKsAndEmulators();
	}

	/**
	 * Initializes device tracking.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async initDevices() {
		this.trackDeviceHandle = await androidlib.devices
			.trackDevices()
			.on('devices', devices => {
				console.log('Devices changed');
				gawk.set(this.data.devices, devices);
			})
			.on('error', err => {
				console.log('Track devices returned error: %s', err.message);
			});
	}

	/**
	 * Wires up the Android NDK detect engine.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async initNDKs() {
		this.ndkDetectEngine = new DetectEngine({
			checkDir(dir) {
				try {
					return new androidlib.ndk.NDK(dir);
				} catch (e) {
					// 'dir' is not an NDK
				}
			},
			depth:     1,
			env:       'ANDROID_NDK',
			exe:       `ndk-build${cmd}`,
			multiple:  true,
			paths:     androidlib.ndk.ndkLocations[process.platform],
			// processResults: async (results, engine) => {
			//
			// },
			recursive: true,
			redetect:  true,
			watch:     true
		});

		// listen for ndk results
		this.ndkDetectEngine.on('results', results => {
			gawk.set(this.data.ndk, results);
		});

		await this.ndkDetectEngine.start();
	}

	/**
	 * Wires up the Android SDK detect engine.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async initSDKsAndEmulators() {
		const paths = [ ...androidlib.sdk.sdkLocations[process.platform] ];
		const defaultPath = get(this.config, 'android.sdkPath');
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
			exe: [ `adb${exe}`, `android${bat}` ],
			multiple: true,
			paths,
			// processResults: async (results, engine) => {
			//
			// },
			recursive: true,
			registryKeys: [
				{
					hive: 'HKLM',
					key: 'SOFTWARE\\Wow6432Node\\Android SDK Tools',
					name: 'Path'
				},
				{
					hive: 'HKLM',
					key: 'SOFTWARE\\Android Studio',
					name: 'SdkPath'
				}
			],
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

		if (this.ndkDetectEngine) {
			await this.ndkDetectEngine.stop();
			this.ndkDetectEngine = null;
		}
	}
}
