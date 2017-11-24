import gawk from 'gawk';
import windowslib from 'windowslib';

import { DataServiceDispatcher } from 'appcd-dispatcher';
import { get } from 'appcd-util';

/**
 * The Windows info service.
 */
export default class WindowsInfoService extends DataServiceDispatcher {

	/**
	 * Initializes the timers for polling Windows information.
	 *
	 * @param {Config} cfg - An Appc Daemon config object.
	 * @returns {Promise}
	 * @access public
	 */
	async activate(cfg) {
		this.data = gawk({
			devices: [],
			emulators: {},
			windows: {},
			visualstudio: {},
			windowsphone: {},
			selectedVisualStudio: {}
		});

		this.timers = {};

		// wire up Visual Studio detection first so that we can use its result to know if we should query the other thing
		await this.wireupDetection('visualstudio',    get(cfg, 'visualstudio.pollInterval') || 60000 * 10, () => this.detectVisualStudios());

		await Promise.all([
			this.wireupDetection('emulators',          get(cfg, 'emulators.pollInterval')    || 60000 * 5,  () => this.detectEmulators()),
			this.wireupDetection('windows',       get(cfg, 'windows.pollInterval')      || 60000 / 2,  () => this.detectWindowsSDKs()),
			this.wireupDetection('windowsphone', get(cfg, 'windowsphone.pollInterval') || 60000 / 2,  () => this.detectWindowsPhone())
		]);

		// wire up devices after the rest to avoid DAEMON-173 where emulator and
		// device detect functions attempt to build and write wptool at the same time
		await this.wireupDetection('devices',          get(cfg, 'device.pollInterval')       || 2500,       () => this.detectDevices());
	}

	/**
	 * Stops all active timers.
	 *
	 * @access public
	 */
	deactivate() {
		for (const timer of Object.values(this.timers)) {
			clearTimeout(timer);
		}
		this.timers = {};
	}

	/**
	 * Executes a detect function, then stores the result and schedules the next check.
	 *
	 * @param {String} type - The bucket name for the detected results.
	 * @param {Number} interval - The amount of milliseconds until the next check.
	 * @param {Function} callback - A function to call that performs the detection.
	 * @returns {Promise}
	 * @access private
	 */
	wireupDetection(type, interval, callback) {
		return callback()
			.then(result => {
				if (result) {
					console.log(`Updating data for ${type}`);
					gawk.set(this.data[type], result);
				}
			})
			.catch(err => {
				console.log(err);
			})
			.then(() => {
				this.timers[type] = setTimeout(() => {
					this.wireupDetection(type, interval, callback);
				}, interval);
			});
	}

	/**
	 * Checks if there are any Visual Studios installed.
	 *
	 * @returns {Boolean}
	 * @access private
	 */
	haveVisualStudio() {
		return Object.keys(this.data.visualstudio).length > 0;
	}

	/**
	 * Detect Windows Phone devices.
	 *
	 * @returns {Promise<Array.<Object>>}
	 * @access private
	 */
	detectDevices() {
		return new Promise((resolve, reject) => {
			if (!this.haveVisualStudio()) {
				return resolve();
			}

			console.log('Detecting devices info');
			windowslib.device.detect({ bypassCache: true }, (err, results) => {
				if (err) {
					reject(err);
				} else {
					const devices = results.devices;
					let wpsdkIndex = -1;
					let	realDeviceIndex = -1;
					for (let i = 0; i < devices.length; i++) {
						const device = devices[i];
						if (device.udid === 0 && device.wpsdk) {
							wpsdkIndex = i;
						} else if (device.udid !== 0 && !device.wpsdk) {
							// now find with "real" device
							realDeviceIndex = i;
						}
						if (wpsdkIndex !== -1 && realDeviceIndex !== -1) {
							break;
						}
					}
					if (wpsdkIndex !== -1 && realDeviceIndex !== -1) {
						// set 'real' device wpsdk to the value we got from wptool binary
						devices[realDeviceIndex].wpsdk = devices[wpsdkIndex].wpsdk;
						// remove the wptool binary entry
						devices.splice(wpsdkIndex, 1);
					}
					resolve(devices);
				}
			});
		});
	}

	/**
	 * Detect Windows Phone emulators.
	 *
	 * @returns {Promise<Object>}
	 * @access private
	 */
	detectEmulators() {
		return new Promise((resolve, reject) => {
			if (!this.haveVisualStudio()) {
				return resolve();
			}

			console.log('Detecting emulator info');
			windowslib.emulator.detect({ bypassCache: true }, (err, results) => {
				if (err) {
					reject(err);
				} else {
					resolve(results.emulators);
				}
			});
		});
	}

	/**
	 * Detect Visual Studio installations.
	 *
	 * @returns {Promise<Object>}
	 * @access private
	 */
	detectVisualStudios() {
		return new Promise((resolve, reject) => {
			console.log('Detecting visualstudio info');
			windowslib.visualstudio.detect({ bypassCache: true }, (err, results) => {
				if (err) {
					return reject(err);
				}

				let found = false;
				if (results.visualstudio) {
					for (const visualstudio of Object.keys(results.visualstudio)) {
						if (results.visualstudio[visualstudio].selected) {
							found = true;
							gawk.set(this.data.selectedVisualStudio, results.visualstudio[visualstudio]);
							break;
						}
					}
				}
				if (!found) {
					this.data.selectedVisualStudio = null;
				}

				resolve(results.visualstudio);
			});
		});
	}

	/**
	 * Detect Windows Store SDK information.
	 *
	 * @returns {Promise<Object>}
	 * @access private
	 */
	detectWindowsSDKs() {
		return new Promise((resolve, reject) => {
			console.log('Detecting windows store info');
			windowslib.winstore.detect({ bypassCache: true }, (err, results) => {
				if (err) {
					reject(err);
				} else {
					resolve(results.windows);
				}
			});
		});
	}

	/**
	 * Detect Windows Phone SDK information.
	 *
	 * @returns {Promise<Object>}
	 * @access private
	 */
	detectWindowsPhone() {
		return new Promise((resolve, reject) => {
			console.log('Detecting windowsphone info');
			windowslib.windowsphone.detect({ bypassCache: true }, (err, results) => {
				if (err) {
					reject(err);
				} else {
					resolve(results.windowsphone);
				}
			});
		});
	}
}
