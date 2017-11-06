import gawk from 'gawk';
import windowslib from 'windowslib';

import { DataServiceDispatcher } from 'appcd-dispatcher';

/**
 * The Windows info service.
 */
export default class WindowsInfoService extends DataServiceDispatcher {

	/**
	 * Initializes the various functions to detect Windows information
	 * @param {Config} cfg - An Appc Daemon config object
	 * @access public
	 */
	async activate(cfg) {
		// TODO: Allow config override for the timing?
		this.data = gawk({
			windows: {},
			windowsphone: {},
			powershell: {},
			visualstudio: {},
			emulators: {},
			devices: []
		});
		this.timers = {};
		await Promise.all([
			this.wireupDetection('devices',              2500,       () => this.detectDevices()),
			this.wireupDetection('emulators',            5 * 60000,  () => this.detectEmulators()),
			this.wireupDetection('powershell',           60000,      () => this.detectPowershell()),
			this.wireupDetection('visualstudio',         10 * 60000, () => this.detectVisualStudios()),
			this.wireupDetection('winstore',             5 * 6000,   () => this.detectWinstore()),
			this.wireupDetection('windowsphone',         5 * 6000,   () => this.detectWindowsphone())
		]);
	}

	/**
	 *
	 * @access public
	 */
	async deactivate() {
		for (const timer of Object.values(this.timers)) {
			clearTimeout(timer);
		}
		this.timers = {};
	}

	wireupDetection(type, interval, callback) {
		return callback()
			.then(({ name, result }) => {
				console.log(`Updating data for ${name}`);
				gawk.set(this.data[name], result);
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

	detectPowershell() {
		return new Promise((resolve, reject) => {
			console.log('Detecting powershell info');
			windowslib.env.detect({ bypassCache: true }, (err, { powershell }) => {
				if (err) {
					reject(err);
				} else {
					resolve({ name: 'powershell', result: powershell });
				}
			});
		});
	}

	detectDevices() {
		return new Promise((resolve, reject) => {
			console.log('Detecting devices info');
			windowslib.device.detect({ bypassCache: true }, (err, { devices }) => {
				if (err) {
					reject(err);
				} else {
					resolve({ name: 'devices', result: devices });
				}
			});
		});
	}

	detectEmulators() {
		return new Promise((resolve, reject) => {
			console.log('Detecting emulator info');
			windowslib.emulator.detect({ bypassCache: true }, (err, { emulators }) => {
				if (err) {
					reject(err);
				} else {
					resolve({ name: 'emulators', result: emulators });
				}
			});
		});
	}

	detectVisualStudios() {
		return new Promise((resolve, reject) => {
			console.log('Detecting visualstudio info');
			windowslib.visualstudio.detect({ bypassCache: true }, (err, { visualstudio }) => {
				if (err) {
					reject(err);
				} else {
					resolve({ name: 'visualstudio', result: visualstudio });
				}
			});
		});
	}

	detectWindowsphone() {
		return new Promise((resolve, reject) => {
			console.log('Detecting windowsphone info');
			windowslib.windowsphone.detect({ bypassCache: true }, (err, { windowsphone }) => {
				if (err) {
					reject(err);
				} else {
					resolve({ name: 'windowsphone', result: windowsphone });
				}
			});
		});
	}

	detectWinstore() {
		return new Promise((resolve, reject) => {
			console.log('Detecting windows store info');
			windowslib.winstore.detect({ bypassCache: true }, (err, { windows }) => {
				if (err) {
					reject(err);
				} else {
					resolve({ name: 'windows', result: windows });
				}
			});
		});
	}
}
