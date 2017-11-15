import DetectEngine from 'appcd-detect';
import gawk from 'gawk';
import path from 'path';

import * as registry from 'appcd-winreg';

import { DataServiceDispatcher } from 'appcd-dispatcher';
import { debounce, get } from 'appcd-util';
import { expandPath } from 'appcd-path';
import { exe } from 'appcd-subprocess';
import { genymotion, virtualbox } from 'androidlib';
import { isDir } from 'appcd-fs';

const GENYMOTION_HOME = 1;
const GENYMOTION_PLIST = 1;

/**
 * The Genymotion and VirtualBox info service.
 */
export default class GenymotionInfoService extends DataServiceDispatcher {
	/**
	 * Starts the detect all Genymotion and VirtualBox service.
	 *
	 * @param {Config} cfg - An Appc Daemon config object.
	 * @access public
	 */
	async activate(cfg) {
		this.config = cfg;

		this.timers = {};

		this.data = gawk({
			deployedDir: null,
			emulators: [],
			executables: {},
			home: null,
			path: null,
			version: null,
			virtualbox: null
		});

		const paths = [ ...genymotion.genymotionLocations[process.platform] ];
		const defaultPath = get(this.config, 'genymotion.path');
		if (defaultPath) {
			paths.unshift(defaultPath);
		}

		this.genyEngine = new DetectEngine({
			checkDir: async (dir) => {
				try {
					// We need to store a reference to the class as we lose the
					// functions in the gawk.set() call
					return this.geny = await genymotion.detect(dir, this.vbox);
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

		this.genyEngine.on('results', results => {
			results.virtualbox = this.data.virtualbox || {};
			this.watchGenymotionDeployed(results.deployedDir);
			if (process.platform === 'darwin') {
				this.watch({
					type: GENYMOTION_PLIST,
					paths: [ genymotion.genymotionPlist ],
					depth: 2,
					handler: async () => {
						const sids = this.subscriptions[GENYMOTION_HOME] ? Object.keys(this.subscriptions[GENYMOTION_HOME]) : [];

						this.genyEngine.rescan(this.data.virtualbox);
						// unwatch the old subscriptions
						await this.unwatch(GENYMOTION_HOME, sids);
					}
				});
			} else if (process.platform === 'win32') {
				this.refreshDeployPath();
			}
			gawk.set(this.data, results);
		});

		this.vboxEngine = new DetectEngine({
			checkDir(dir) {
				try {
					return new virtualbox.VirtualBox(dir);
					// return new androidlib.VirtualBox(dir);
				} catch (e) {
					// Squelch
				}
			},
			depth:                1,
			exe:                  `vboxmanage${exe}`,
			multiple:             false,
			paths:                virtualbox.virtualBoxLocations[process.platform],
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
			this.vbox = results;
			this.data.virtualbox = gawk.set(this.data.virtualbox || {}, results) || null;
			this.genyEngine.rescan(this.data.virtualbox);
		});

		await this.vboxEngine.start();
		await this.genyEngine.start();
	}

	/**
	 * Poll the registry for the vms.path value
	 */
	refreshDeployPath() {
		this.refreshDeployPathTimer = setTimeout(async () => {
			try {
				const dir = expandPath(await registry.get('HKCU', 'Software\\Genymobile\\Genymotion', 'vms.path'));

				if (isDir(dir) && this.data.deployedDir !== dir) {

					const sids = this.subscriptions[GENYMOTION_HOME] ? Object.keys(this.subscriptions[GENYMOTION_HOME]) : [];

					this.genyEngine.rescan(this.data.virtualbox);

					await this.unwatch(GENYMOTION_HOME, sids);
				}
			} catch (err) {
				// squelch
			}

			this.refreshDeployPath();
		}, 15000);
	}

	/**
	 * Watch the given Genymotion deploy directory.
	 * @param {String} deployedDir - The path to the directory.
	 */
	watchGenymotionDeployed(deployedDir) {
		const onEmulatorAdd = debounce(async () => {
			gawk.set(this.data.emulators, await genymotion.getEmulators({ force: true, vbox: this.vbox }));
		}, 10000);

		const onEmulatorChange = debounce(async (file) => {
			const { emulators } = this.data;
			for (let i = 0; i < emulators.length; i++) {
				if (emulators[i].name === path.basename(file, '.vbox')) {
					const emulator = await genymotion.getEmulatorInfo({ vm: emulators[i], vbox: this.vbox });
					if (emulator) {
						emulators[i] = emulator;
						gawk.set(this.data.emulators, emulators);
						break;
					}
				}
			}
		}, 500);
		let detecting;
		this.watch({
			type: GENYMOTION_HOME,
			paths: [ deployedDir ],
			depth: 2,
			handler: async ({ file, filename, action }) => {
				const { emulators } = this.data;
				if (action === 'add' && path.dirname(file) === deployedDir && !detecting) {
					detecting = true;
					await onEmulatorAdd();
					detecting = false;
				} else if (action === 'change' && path.extname(file) === '.vbox' && !detecting) {
					await onEmulatorChange(file);
				} else if (action === 'delete' && (path.dirname(file) === deployedDir)) {
					// find the emulator in the data store and remove it
					for (let i = 0; i < emulators.length; i++) {
						if (emulators[i].name === filename) {
							emulators.splice(i--, 1);
							break;
						}
					}
					gawk.set(this.data.emulators, emulators);
				}
			}
		});
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

		if (this.subscriptions) {
			for (const type of Object.keys(this.subscriptions)) {
				await this.unwatch(type);
			}
		}

		if (this.refreshDeployPathTimer) {
			clearTimeout(this.refreshDeployPathTimer);
			this.refreshDeployPathTimer = null;
		}
	}
}
