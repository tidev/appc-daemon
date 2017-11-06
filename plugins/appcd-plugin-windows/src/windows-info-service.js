import gawk from 'gawk';
import windowslib from 'windowslib';

import { DataServiceDispatcher } from 'appcd-dispatcher';

/**
 * The Windows info service.
 */
export default class WindowsInfoService extends DataServiceDispatcher {

	/**
	 * @param {Config} cfg - An Appc Daemon config object
	 * @access public
	 */
	async activate(cfg) {
		// TODO: Allow config override for the timing?
		this.data = gawk({
			issues: [],
			assemblies: {},
			windows: {},
			windowsphone: {},
			os: {},
			powershell: {},
			selectedVisualStudio: {},
			visualstudio: {},
			emulators: {},
			devices: []
		});
		this.timers = {};
		await Promise.all([
			this.wireupDetection('assemblies', 60000, () => this.detectAssemblies()),
			this.wireupDetection('devices', 2500, () => this.detectDevices()),
			this.wireupDetection('emulators', 5 * 60000, () => this.detectEmulators()),
			this.wireupDetection('os', 60000, () => this.detectOS()),
			this.wireupDetection('powershell', 60000, () => this.detectPowershell()),
			this.wireupDetection('visualstudio', 10 * 60000, () => this.detectVisualStudios()),
			this.wireupDetection('selectedVisualStudio', 5 * 60000, () => this.detectSelectedVisualStudio()),
			this.wireupDetection('winstore', 5 * 6000, () => this.detectWinstore()),
			this.wireupDetection('windowsphone', 5 * 6000, () => this.detectWindowsphone())
		]);
	}

	/**
	 * ?
	 *
	 * @access public
	 */
	async deactivate() {
		for (const timer of Object.values(this.timers)) {
			clearTimeout(timer);
		}
		this.timers = {};
	}

	async wireupDetection(type, interval, callback) {
		await callback()
			.then(({ name, result, issues }) => {
				console.log(`Updating data for ${name}`);
				if (this.data[name]) {
					if (Array.isArray(result)) {
						gawk.set(this.data[name], result);
					} else {
						gawk.mergeDeep(this.data[name], result);
					}
				} else {
					this.data[name] = result;

				}

				if (this.data.issues) {
					gawk.set(this.data.issues, issues);
				} else {
					this.data.issues = issues;
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

	detectAssemblies() {
		return new Promise((resolve, reject) => {
			console.log('Detecting assemblies info');
			windowslib.assemblies.detect({ bypassCache: true }, (err, { issues, assemblies }) => {
				if (err) {
					reject(err);
				} else {
					resolve({ name: 'assemblies', result: assemblies, issues });
				}
			});
		});
	}

	detectOS() {
		return new Promise((resolve, reject) => {
			console.log('Detecting os info');
			windowslib.env.detect({ bypassCache: true }, (err, { issues, os }) => {
				if (err) {
					reject(err);
				} else {
					resolve({ name: 'os', result: os, issues });
				}
			});
		});
	}

	detectPowershell() {
		return new Promise((resolve, reject) => {
			console.log('Detecting powershell info');
			windowslib.env.detect({ bypassCache: true }, (err, { issues, powershell }) => {
				if (err) {
					reject(err);
				} else {
					resolve({ name: 'powershell', result: powershell, issues });
				}
			});
		});
	}

	detectDevices() {
		return new Promise((resolve, reject) => {
			console.log('Detecting devices info');
			windowslib.device.detect({ bypassCache: true }, (err, { issues, devices }) => {
				if (err) {
					reject(err);
				} else {
					resolve({ name: 'devices', result: devices, issues });
				}
			});
		});
	}

	detectEmulators() {
		return new Promise((resolve, reject) => {
			console.log('Detecting emulator info');
			windowslib.emulator.detect({ bypassCache: true }, (err, { issues, emulators }) => {
				if (err) {
					reject(err);
				} else {
					resolve({ name: 'emulators', result: emulators, issues });
				}
			});
		});
	}

	detectSelectedVisualStudio() {
		return new Promise((resolve, reject) => {
			console.log('Detecting selectedVisualStudio info');
			windowslib.visualstudio.detect({ bypassCache: true }, (err, { issues, selectedVisualStudio }) => {
				if (err) {
					reject(err);
				} else {
					resolve({ name: 'selectedVisualStudio', result: selectedVisualStudio, issues });
				}
			});
		});
	}

	detectVisualStudios() {
		return new Promise((resolve, reject) => {
			console.log('Detecting visualstudio info');
			windowslib.visualstudio.detect({ bypassCache: true }, (err, { issues, visualstudio }) => {
				if (err) {
					reject(err);
				} else {
					resolve({ name: 'visualstudio', result: visualstudio, issues });
				}
			});
		});
	}

	detectWindowsphone() {
		return new Promise((resolve, reject) => {
			console.log('Detecting windowsphone info');
			windowslib.windowsphone.detect({ bypassCache: true }, (err, { issues, windowsphone }) => {
				if (err) {
					reject(err);
				} else {
					resolve({ name: 'windowsphone', result: windowsphone, issues });
				}
			});
		});
	}

	detectWinstore() {
		return new Promise((resolve, reject) => {
			console.log('Detecting windows store info');
			windowslib.winstore.detect({ bypassCache: true }, (err, { issues, windows }) => {
				if (err) {
					reject(err);
				} else {
					resolve({ name: 'windows', result: windows, issues });
				}
			});
		});
	}
}
