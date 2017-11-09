import DetectEngine from 'appcd-detect';
import gawk from 'gawk';
import path from 'path';
import fs from 'fs';

import { DataServiceDispatcher } from 'appcd-dispatcher';
import { debounce, sleep } from 'appcd-util';
import { exe } from 'appcd-subprocess';
import { genymotionLocations, detect as genyDetect, getEmulators } from './genymotion';
import { virtualBoxLocations, VirtualBox } from './virtualbox';

const GENYMOTION_HOME = 1;
let DEPLOYED_DIR;
let VBOX;

/**
 * The Genymotion and VirtualBox info service.
 */
export default class GenymotionInfoService extends DataServiceDispatcher {
	/**
	 * Starts the detect all Genymotion and VirtualBox service
	 *
	 * @param {Config} cfg - An Appc Daemon config object.
	 * @access public
	 */
	async activate(cfg) {
		this.cfg = cfg;

		this.data = gawk({
			emulators: [],
			executables: {},
			home: null,
			path: null,
			version: null,
			virtualbox: {},
		});

		const paths = [ ...genymotionLocations[process.platform] ];
		const defaultPath = this.getConfig('genymotion.installDir');
		if (defaultPath) {
			paths.unshift(defaultPath);
		}
		this.genyEngine = new DetectEngine({
			checkDir: async (dir) => {
				try {
					return await genyDetect(dir);
				} catch (e) {
					// squelch
				}
			},
			depth:                1,
			exe:                  `genymotion${exe}`,
			multiple:             false,
			paths,
			redetect:             true,
			refreshPathsInterval: 15000,
			watch:                true
		});

		const onEmulatorAdd = debounce(async () => {
			await sleep(10000);
			gawk.set(this.data.emulators, await getEmulators(VBOX || {}));
		});

		this.genyEngine.on('results', results => {
			results.virtualbox = this.data.virtualbox || {};
			DEPLOYED_DIR = path.join(results.home, 'deployed');
			this.watch({
				type: GENYMOTION_HOME,
				paths: [ DEPLOYED_DIR ],
				depth: 1,
				handler: async ({ file, filename, action }) => {
					const { emulators } = this.data;
					if ((action === 'add' || action === 'change') && (path.dirname(file) === DEPLOYED_DIR)) {
						await onEmulatorAdd();
					}  else if (action === 'delete' && (path.dirname(file) === DEPLOYED_DIR)) {
						// find the emulator in the data store and remove it
						for (let i = 0, len = emulators.length; i < len; i++) {
							if (emulators[i].name === filename) {
								emulators.splice(i, 1);
							}
						}
						gawk.set(this.data.emulators, emulators);
					}
				}
			});

			gawk.set(this.data, results);
		});

		this.vboxEngine = new DetectEngine({
			checkDir(dir) {
				try {
					return VBOX = new VirtualBox(dir);
				} catch (e) {
					// Squelch
				}
			},
			depth:                1,
			exe:                  `vboxmanage${exe}`,
			multiple:             false,
			paths:                virtualBoxLocations[process.platform],
			redetect:             true,
			refreshPathsInterval: 15000,
			registryKeys: {
				hive: 'HKLM',
				key: 'Software\\Oracle\\VirtualBox',
				name: 'InstallDir'
			},
			watch:                true
		});

		this.vboxEngine.on('results', results => {
			gawk.set(this.data.virtualbox, results);
		});

		await this.vboxEngine.start();
		await this.genyEngine.start();
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
	 * Subscribes to filesystem events for the specified paths.
	 *
	 * @param {Object} params - Various parameters.
	 * @param {String} params.type - The type of subscription.
	 * @param {Array.<String>} params.paths - One or more paths to watch.
	 * @param {Function} params.handler - A callback function to fire when a fs event occurs.
	 * @param {Number} [params.depth] - The max depth to recursively watch.
	 * @access private
	 */
	watch({ type, paths, handler, depth }) {
		for (const path of paths) {
			const data = { path };
			if (depth) {
				data.recursive = true;
				data.depth = depth;
			}

			appcd
				.call('/appcd/fswatch', {
					data,
					type: 'subscribe'
				})
				.then(ctx => {
					let sid;
					ctx.response
						.on('data', async (data) => {
							if (data.type === 'subscribe') {
								sid = data.sid;
								if (!this.subscriptions[type]) {
									this.subscriptions[type] = {};
								}
								this.subscriptions[type][data.sid] = 1;
							} else if (data.type === 'event') {
								handler(data.message);
							}
						})
						.on('end', () => {
							if (sid) {
								delete this.subscriptions[type][sid];
							}
						});
				});
		}
	}

	/**
	 * Unsubscribes a list of filesystem watcher subscription ids.
	 *
	 * @param {Number} type - The type of subscription.
	 * @param {Array.<String>} [sids] - An array of subscription ids to unsubscribe. If not
	 * specified, defaults to all sids for the specified types.
	 * @access private
	 */
	async unwatch(type, sids) {
		if (!sids) {
			sids = Object.keys(this.subscriptions[type]);
		}

		for (const sid of sids) {
			await appcd.call('/appcd/fswatch', {
				sid,
				type: 'unsubscribe'
			});

			delete this.subscriptions[type][sid];
		}

		if (!Object.keys(this.subscriptions[type])) {
			delete this.subscriptions[type];
		}
	}

	/**
	 * Stops the Genymotion-related environment watchers.
	 *
	 * @access public
	 */
	async deactivate() {
		if (this.genyEngine) {
			await this.genyEngine.stop();
			this.genyEngine = null;
		}

		if (this.vboxEngine) {
			await this.vboxEngine.stop();
			this.vboxEngine = null;
		}
	}
}
