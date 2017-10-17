/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import fs from 'fs';
import gawk from 'gawk';
import os from 'os';

import { arch } from 'appcd-util';
import { codes } from 'appcd-response';
import { DispatcherError, ServiceDispatcher } from 'appcd-dispatcher';
import { isFile } from 'appcd-fs';
import { run } from 'appcd-subprocess';

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
			jdk: null,
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
	async activate(cfg) {
		await this.initOSInfo();
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
	 * Responds to "call" service requests.
	 *
	 * @param {Object} ctx - A dispatcher request context.
	 * @access private
	 */
	onCall(ctx) {
		const filter = ctx.params.filter && ctx.params.filter.replace(/^\//, '').split(/\.|\//) || undefined;

		const node = this.get(filter);
		if (!node) {
			throw new DispatcherError(codes.NOT_FOUND);
		}

		ctx.response = node;
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

// export function deactivate() {
// }
