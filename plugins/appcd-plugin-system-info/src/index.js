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
import { codes } from 'appcd-response';
import { DispatcherError, ServiceDispatcher } from 'appcd-dispatcher';
import { expandPath } from 'appcd-path';
import { isFile } from 'appcd-fs';

/**
 * Aggregrates system info from Android, iOS, JDK, and Windows libraries.
 */
class SystemInfoService extends ServiceDispatcher {
	/**
	 * Initializes the service path.
	 */
	constructor() {
		super('/:filter*');

		this.results = gawk({
			android: null,
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
	}

	/**
	 * Initializes the OS info and subscribes to the various specific information services.
	 *
	 * @param {Config} cfg - An Appc Daemon config object
	 * @returns {Promise}
	 * @access public
	 */
	activate(cfg) {
		return Promise.all([
			// get the os info
			this.initOSInfo(),

			// get the npm info
			this.npmInfo(),

			// subscribe to android service
			this.wireup('android', '/android/latest/info'),

			// subscribe to ios service
			process.platform === 'darwin' && this.wireup('ios', '/ios/latest/info'),

			// subscribe to jdk service
			this.wireup('jdks', '/jdk/latest/info'),

			// subscribe to windows service
			process.platform === 'win32' && this.wireup('windows', '/windows/latest/info')
		]);
	}

	/**
	 * Wires up the subscription to one of the info services.
	 *
	 * @param {String} type - The bucket type to merge the results into.
	 * @param {String} endpoint - The service endpoint to subscribe to.
	 * @returns {Promise}
	 * @access private
	 */
	wireup(type, endpoint) {
		return new Promise(resolve => {
			appcd.call(endpoint, { type: 'subscribe' })
				.then(({ response }) => {
					response.on('data', data => {
						if (data.type === 'event' && data.message && typeof data.message === 'object') {
							if (!this.results[type]) {
								this.results[type] = {};
							}

							if (Array.isArray(data.message)) {
								this.results[type] = data.message;
							} else {
								gawk.mergeDeep(this.results[type], data.message);
							}

							resolve();
						}
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
						this.results.os.name = m[1];
					}
					m = stdout.match(/ProductVersion:\s+(.+)/i);
					if (m) {
						this.results.os.version = m[1];
					}
				}
				break;

			case 'linux':
				this.results.os.name = 'GNU/Linux';

				if (isFile('/etc/lsb-release')) {
					const contents = fs.readFileSync('/etc/lsb-release').toString();
					let m = contents.match(/DISTRIB_DESCRIPTION=(.+)/i);
					if (m) {
						this.results.os.name = m[1].replace(/"/g, '');
					}
					m = contents.match(/DISTRIB_RELEASE=(.+)/i);
					if (m) {
						this.results.os.version = m[1].replace(/"/g, '');
					}
				} else if (fs.existsSync('/etc/system-release')) {
					const parts = fs.readFileSync('/etc/system-release').toString().split(' ');
					if (parts[0]) {
						this.results.os.name = parts[0];
					}
					if (parts[2]) {
						this.results.os.version = parts[2];
					}
				}
				break;

			case 'win32':
				{
					const { stdout } = await run('wmic', [ 'os', 'get', 'Caption,Version' ]);
					const s = stdout.split('\n')[1].split(/ {2,}/);
					if (s.length > 0) {
						this.results.os.name = s[0].trim() || 'Windows';
					}
					if (s.length > 1) {
						this.results.os.version = s[1].trim() || '';
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
		let prefix = process.platform === 'win32' ? '%ProgramFiles%\\Node.js' : '/usr/local';

		try {
			npm = await which(`npm${cmd}`);
			const { stdout } = run(npm, 'prefix', '-g');
			prefix = stdout.split('\n')[0].replace(/^"|"$/g, '');
		} catch (e) {
			// squeltch
		}

		let npmPkgJson = expandPath(prefix, 'node_modules', 'npm', 'package.json');
		if (!isFile(npmPkgJson)) {
			// on Linux and macOS, the `node_modules` is inside a `lib` directory
			npmPkgJson = expandPath(prefix, 'lib', 'node_modules', 'npm', 'package.json');
		}

		if (!isFile(npmPkgJson)) {
			// can't find npm, fail :(
			console.log('Unable to find where npm is installed');
			return;
		}

		this.results.npm = {
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
				// squeltch
			}

			this.results.npm.version = ver || null;
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

	/**
	 * Determines the topic for the incoming request.
	 *
	 * @param {DispatcherContext} ctx - The dispatcher request context object.
	 * @returns {String}
	 * @access private
	 */
	getTopic(ctx) {
		const { params, topic } = ctx.request;
		return topic || (params.filter && params.filter.replace(/^\//, '').split(/\.|\//)) || undefined;
	}

	/**
	 * Responds to "call" service requests.
	 *
	 * @param {Object} ctx - A dispatcher request context.
	 * @access private
	 */
	onCall(ctx) {
		const filter = this.getTopic(ctx);
		const node = this.get(filter);

		if (!node) {
			throw new DispatcherError(codes.NOT_FOUND);
		}

		ctx.response = node;
	}

	/**
	 * nitializes the config watch for the filter.
	 *
	 * @param {Object} params - Various parameters.
	 * @param {String} [params.topic] - The filter to apply.
	 * @param {Function} params.publish - A function used to publish data to a dispatcher client.
	 * @access private
	 */
	initSubscription({ topic: filter, publish }) {
		console.log('Starting jdk gawk watch: %s', filter || 'no filter');
		gawk.watch(this.results, filter, publish);
	}

	/**
	 * Handles a new subscriber.
	 *
	 * @param {Object} params - Various parameters.
	 * @param {String} [params.topic] - The filter to apply.
	 * @param {Function} params.publish - A function used to publish data to a dispatcher client.
	 * @access private
	 */
	onSubscribe({ topic: filter, publish }) {
		publish(this.get(filter));
	}

	/**
	 * Stops watching the config updates.
	 *
	 * @param {Object} params - Various parameters.
	 * @param {Function} params.publish - The function used to publish data to a dispatcher client.
	 * This is the same publish function as the one passed to `onSubscribe()`.
	 * @access private
	 */
	destroySubscription({ publish }) {
		console.log('Removing jdk gawk watch');
		gawk.unwatch(this.results, publish);
	}

	/**
	 * Returns the complete or filtered status values.
	 *
	 * @param {Array.<String>} [filter] - An array of namespaces used to filter and return a deep
	 * object.
	 * @return {*}
	 * @access private
	 */
	get(filter) {
		if (filter && !Array.isArray(filter)) {
			throw new TypeError('Expected filter to be an array');
		}

		let obj = this.results;

		if (filter) {
			for (let i = 0, len = filter.length; obj && typeof obj === 'object' && i < len; i++) {
				if (!obj.hasOwnProperty(filter[i])) {
					return null;
				}
				obj = obj[filter[i]];
			}
		}

		return obj;
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
