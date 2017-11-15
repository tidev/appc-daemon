/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import fs from 'fs';
import gawk from 'gawk';
import os from 'os';
import path from 'path';

import { arch } from 'appcd-util';
import { cmd, run, which } from 'appcd-subprocess';
import { DataServiceDispatcher } from 'appcd-dispatcher';
import { expandPath } from 'appcd-path';
import { isFile } from 'appcd-fs';

/**
 * A map of dependent services and their endpoints.
 * @type {Object}
 */
const dependencies = {
	android:    '/android/1.x/info',
	genymotion: '/genymotion/1.x/info',
	ios:        '/ios/1.x/info',
	jdks:       '/jdk/1.x/info',
	windows:    '/windows/1.x/info'
};

/**
 * Aggregrates system info from Android, iOS, JDK, and Windows libraries.
 */
class SystemInfoService extends DataServiceDispatcher {
	/**
	 * Initializes the OS info and subscribes to the various specific information services.
	 *
	 * @param {Config} cfg - An Appc Daemon config object.
	 * @returns {Promise}
	 * @access public
	 */
	activate(cfg) {
		this.data = gawk({
			android: null,
			genymotion: null,
			ios: null,
			jdks: null,
			node: {
				path:     process.execPath,
				version:  process.version.substring(1),
				versions: process.versions
			},
			npm: null,
			os: {
				platform: process.platform,
				name:     'Unknown',
				version:  '',
				arch:     arch(),
				numcpus:  os.cpus().length,
				memory:   os.totalmem()
			},
			titanium: null,
			windows: null
		});

		this.subscriptions = {};

		return Promise.all([
			// get the os info
			this.initOSInfo(),

			// get the npm info
			this.npmInfo(),

			// subscribe to android service
			this.wireup('android'),

			// subscribe to genymotion service
			this.wireup('genymotion'),

			// subscribe to ios service
			process.platform === 'darwin' && this.wireup('ios'),

			// subscribe to jdk service
			this.wireup('jdks'),

			// subscribe to windows service
			process.platform === 'win32' && this.wireup('windows')
		]);
	}

	/**
	 * Responds to "call" service requests.
	 *
	 * @param {DispatcherContext} ctx - A dispatcher request context.
	 * @returns {Promise}
	 * @access private
	 */
	async onCall(ctx) {
		for (const name of Object.keys(dependencies)) {
			if (!this.subscriptions[name]) {
				await this.wireup(name);
			}
		}

		super.onCall(ctx);
	}

	/**
	 * Handles the new subscriber.
	 *
	 * @param {Object} params - Various parameters to forward on to the super method.
	 * @access private
	 */
	async onSubscribe(params) {
		for (const name of Object.keys(dependencies)) {
			if (!this.subscriptions[name]) {
				await this.wireup(name);
			}
		}

		super.onSubscribe(params);
	}

	/**
	 * Wires up the subscription to one of the info services.
	 *
	 * @param {String} type - The bucket type to merge the results into.
	 * @param {String} endpoint - The service endpoint to subscribe to.
	 * @returns {Promise}
	 * @access private
	 */
	wireup(type) {
		const endpoint = dependencies[type];

		return new Promise(resolve => {
			appcd.call(endpoint, { type: 'subscribe' })
				.then(({ response }) => {
					response.on('data', data => {
						if (data.type === 'subscribe') {
							this.subscriptions[type] = data.sid;
						} else if (data.type === 'event' && data.message && typeof data.message === 'object') {
							if (!this.data[type]) {
								this.data[type] = {};
							}

							if (Array.isArray(data.message)) {
								this.data[type] = data.message;
							} else {
								gawk.set(this.data[type], data.message);
							}

							resolve();
						}
					});

					response.on('end', () => {
						delete this.subscriptions[type];
					});
				})
				.catch(err => {
					console.error(err);
					resolve();
				});
		});
	}

	/**
	 * Detects the OS name and version.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async initOSInfo() {
		switch (process.platform) {
			case 'darwin':
				{
					const { stdout } = await run('sw_vers');
					let m = stdout.match(/ProductName:\s+(.+)/i);
					if (m) {
						this.data.os.name = m[1];
					}
					m = stdout.match(/ProductVersion:\s+(.+)/i);
					if (m) {
						this.data.os.version = m[1];
					}
				}
				break;

			case 'linux':
				this.data.os.name = 'GNU/Linux';

				if (isFile('/etc/lsb-release')) {
					const contents = fs.readFileSync('/etc/lsb-release').toString();
					let m = contents.match(/DISTRIB_DESCRIPTION=(.+)/i);
					if (m) {
						this.data.os.name = m[1].replace(/"/g, '');
					}
					m = contents.match(/DISTRIB_RELEASE=(.+)/i);
					if (m) {
						this.data.os.version = m[1].replace(/"/g, '');
					}
				} else if (fs.existsSync('/etc/system-release')) {
					const parts = fs.readFileSync('/etc/system-release').toString().split(' ');
					if (parts[0]) {
						this.data.os.name = parts[0];
					}
					if (parts[2]) {
						this.data.os.version = parts[2];
					}
				}
				break;

			case 'win32':
				{
					const { stdout } = await run('wmic', [ 'os', 'get', 'Caption,Version' ]);
					const s = stdout.split('\n')[1].split(/ {2,}/);
					if (s.length > 0) {
						this.data.os.name = s[0].trim() || 'Windows';
					}
					if (s.length > 1) {
						this.data.os.version = s[1].trim() || '';
					}
				}
				break;
		}
	}

	/**
	 * Detects the NPM information.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async npmInfo() {
		let npm = null;
		let prefix;

		try {
			npm = await which(`npm${cmd}`);
			const { stdout } = await run(npm, [ 'prefix', '-g' ]);
			prefix = stdout.split('\n')[0].replace(/^"|"$/g, '');
		} catch (e) {
			// squelch
		}

		let npmPkgJson = expandPath(prefix, 'node_modules', 'npm', 'package.json');
		if (!isFile(npmPkgJson)) {
			prefix = process.platform === 'win32' ? '%ProgramFiles%\\nodejs' : '/usr/local';
			// on Linux and macOS, the `node_modules` is inside a `lib` directory
			npmPkgJson = expandPath(prefix, 'node_modules', 'npm', 'package.json');
			if (!isFile(npmPkgJson)) {
				if (process.platform !== 'win32') {
					npmPkgJson = expandPath(prefix, 'lib', 'node_modules', 'npm', 'package.json');
				} else {
					npmPkgJson = expandPath('%ProgramFiles(x86)%\\nodejs', 'node_modules', 'npm', 'package.json');
				}
			}
		}

		if (!isFile(npmPkgJson)) {
			// can't find npm, fail :(
			console.log('Unable to find where npm is installed');
			return;
		}

		this.data.npm = {
			home:    path.dirname(npmPkgJson),
			path:    npm,
			version: null
		};

		const readPkgJson = () => {
			let ver;

			try {
				const json = JSON.parse(fs.readFileSync(npmPkgJson));
				ver = json && json.version;
			} catch (e) {
				// squelch
			}

			this.data.npm.version = ver || null;
		};

		readPkgJson();

		const { response } = await appcd.call('/appcd/fswatch', {
			data: {
				path: npmPkgJson
			},
			type: 'subscribe'
		});

		response.on('data', data => {
			if (data.type === 'subscribe') {
				this.npmSubscriptionId = data.sid;
			} else if (data.type === 'event') {
				readPkgJson();
			}
		});
	}
}

const systemInfo = new SystemInfoService();

export async function activate(cfg) {
	await systemInfo.activate(cfg);
	appcd.register('/info', systemInfo);
}

export async function deactivate() {
	if (this.npmSubscriptionId) {
		await appcd.call('/appcd/fswatch', {
			sid: this.npmSubscriptionId,
			type: 'unsubscribe'
		});
		this.npmSubscriptionId = null;
	}
}
