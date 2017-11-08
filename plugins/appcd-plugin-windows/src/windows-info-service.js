import gawk from 'gawk';
import windowslib from 'windowslib';

import { DataServiceDispatcher } from 'appcd-dispatcher';

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
			powershell: {},
			windows: {},
			visualstudio: {},
			windowsphone: {}
		});

		this.timers = {};

		// TODO: Allow config override for the timing?
		await Promise.all([
			this.wireupDetection('devices',      2500,       () => this.detectDevices()),
			this.wireupDetection('emulators',    60000 * 5,  () => this.detectEmulators()),
			this.wireupDetection('powershell',   60000,      () => this.detectPowershell()),
			this.wireupDetection('visualstudio', 60000 * 10, () => this.detectVisualStudios()),
			this.wireupDetection('windows',      60000 / 2,  () => this.detectWindows()),
			this.wireupDetection('windowsphone', 60000 / 2,  () => this.detectWindowsPhone())
		]);
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
				console.log(`Updating data for ${type}`);
				gawk.set(this.data[type], result);
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
	 * Detect Windows Phone devices.
	 *
	 * @returns {Promise<Array.<Object>>}
	 * @access private
	 */
	detectDevices() {
		return new Promise((resolve, reject) => {
			console.log('Detecting devices info');
			windowslib.device.detect({ bypassCache: true }, (err, results) => {
				if (err) {
					reject(err);
				} else {
					resolve(results.devices);
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
	 * Detect Powershell information.
	 *
	 * @returns {Promise<Object>}
	 * @access private
	 */
	detectPowershell() {
		return new Promise((resolve, reject) => {
			console.log('Detecting powershell info');
			windowslib.env.detect({ bypassCache: true }, (err, results) => {
				if (err) {
					reject(err);
				} else {
					resolve(results.powershell);
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
					reject(err);
				} else {
					resolve(results.visualstudio);
				}
			});
		});
	}

	/**
	 * Detect Windows Store SDK information.
	 *
	 * @returns {Promise<Object>}
	 * @access private
	 */
	detectWindows() {
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
