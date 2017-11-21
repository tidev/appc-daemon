import DetectEngine from 'appcd-detect';
import gawk from 'gawk';
import path from 'path';

import { DataServiceDispatcher } from 'appcd-dispatcher';
import { debounce as debouncer, get, tailgate } from 'appcd-util';
import { expandPath } from 'appcd-path';
import { exe } from 'appcd-subprocess';
import { genymotion, virtualbox } from 'androidlib';

const GENYMOTION_DEPLOYED_DIR = 1;
const GENYMOTION_PLIST = 2;

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

		this.virtualbox = gawk({});

		this.data = gawk({
			deployedDir: null,
			emulators: [],
			executables: {},
			home: null,
			path: null,
			version: null,
			virtualbox: null
		});

		await this.initVirtualBox();
		await this.initGenymotion();
	}

	/**
	 * Detects where VirtualBox is installed.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async initVirtualBox() {
		this.vboxEngine = new DetectEngine({
			checkDir(dir) {
				try {
					return new virtualbox.VirtualBox(dir);
				} catch (e) {
					// Squelch
				}
			},
			depth:                1,
			exe:                  `vboxmanage${exe}`,
			multiple:             false,
			name:                 'virtualbox',
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
			gawk.set(this.virtualbox, results);
		});

		await this.vboxEngine.start();
	}

	/**
	 * Detects Genymotion and its emulators.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async initGenymotion() {
		const paths = [ get(this.config, 'android.genymotion.searchPaths'), ...genymotion.genymotionLocations[process.platform] ];

		this.genyEngine = new DetectEngine({
			checkDir: async (dir) => {
				try {
					return await genymotion.detect(dir, this.virtualbox);
				} catch (e) {
					// squelch
				}
			},
			depth:    1,
			exe:      `genymotion${exe}`,
			multiple: false,
			name:     'genymotion',
			paths,
			processResults: (results, engine) => {
				for (const r of results) {
					r.virtualbox = this.virtualbox || {};
				}
			},
			redetect: true,
			watch:    true
		});

		this.genyEngine.on('results', async (results) => {
			await this.watchGenymotionDeployed(this.data.deployedDir, results.deployedDir);
			gawk.set(this.data, results);
		});

		if (process.platform === 'darwin') {
			this.watch({
				type: GENYMOTION_PLIST,
				paths: [ genymotion.genymotionPlist ],
				debounce: true,
				handler: () => {
					return tailgate('genymotion-rescan', async () => {
						console.log(`${genymotion.genymotionPlist} changed, rescanning genymotion`);
						await this.genyEngine.rescan();
					});
				}
			});
		}

		if (process.platform === 'win32') {
			this.refreshDeployPath();
		}

		await this.genyEngine.start();
	}

	/**
	 * Poll the registry for the `vms.path` value.
	 *
	 * @access private
	 */
	refreshDeployPath() {
		this.refreshDeployPathTimer = setTimeout(async () => {
			try {
				await this.watchGenymotionDeployed(this.data.deployedDir, await genymotion.getDeployedDir());
			} catch (err) {
				// squelch
			}
			this.refreshDeployPath();
		}, get(this.config, 'android.genymotion.deployedDirPollInterval') || 15000);
	}

	/**
	 * Watch the given Genymotion deploy directory.
	 *
	 * @param {String} prevDeployedDir - The previous deployed directory value.
	 * @param {String} newDeployedDir - The new deployed directory value.
	 * @returns {Promise}
	 * @access private
	 */
	async watchGenymotionDeployed(prevDeployedDir, newDeployedDir) {
		if (prevDeployedDir !== newDeployedDir) {
			console.log('Deployed directory changed: %s => %s', prevDeployedDir, newDeployedDir);

			await this.unwatch(GENYMOTION_DEPLOYED_DIR);

			if (newDeployedDir) {
				this.watch({
					type: GENYMOTION_DEPLOYED_DIR,
					paths: [ newDeployedDir ],
					depth: 2,
					debounce: true,
					handler: async ({ file, filename, action }) => {
						console.log('************************************************************************************************************************************************************');
						console.log(action, filename, file);
					}
				});
			}
		}

		// const onEmulatorAdd = debouncer(async () => {
		// 	gawk.set(this.data.emulators, await genymotion.getEmulators({ force: true, vbox: this.vbox }));
		// }, 10000);

		// const onEmulatorChange = debouncer(async (file) => {
		// 	const { emulators } = this.data;
		// 	for (let i = 0; i < emulators.length; i++) {
		// 		if (emulators[i].name === path.basename(file, '.vbox')) {
		// 			const emulator = await genymotion.getEmulatorInfo({ vm: emulators[i], vbox: this.vbox });
		// 			if (emulator) {
		// 				emulators[i] = emulator;
		// 				gawk.set(this.data.emulators, emulators);
		// 				break;
		// 			}
		// 		}
		// 	}
		// }, 500);

		// let detecting;
		// this.watch({
		// 	type: GENYMOTION_DEPLOYED_DIR,
		// 	paths: [ deployedDir ],
		// 	depth: 2,
		// 	handler: async ({ file, filename, action }) => {
		// 		const { emulators } = this.data;
		// 		if (action === 'add' && path.dirname(file) === deployedDir && !detecting) {
		// 			detecting = true;
		// 			await onEmulatorAdd();
		// 			detecting = false;
		// 		} else if (action === 'change' && path.extname(file) === '.vbox' && !detecting) {
		// 			await onEmulatorChange(file);
		// 		} else if (action === 'delete' && (path.dirname(file) === deployedDir)) {
		// 			// find the emulator in the data store and remove it
		// 			for (let i = 0; i < emulators.length; i++) {
		// 				if (emulators[i].name === filename) {
		// 					emulators.splice(i--, 1);
		// 					break;
		// 				}
		// 			}
		// 			gawk.set(this.data.emulators, emulators);
		// 		}
		// 	}
		// });
	}

	/**
	 * Subscribes to filesystem events for the specified paths.
	 *
	 * @param {Object} params - Various parameters.
	 * @param {Boolean} [params.debounce=false] - When `true`, wraps the `handler` with a debouncer.
	 * @param {Number} [params.depth] - The max depth to recursively watch.
	 * @param {Function} params.handler - A callback function to fire when a fs event occurs.
	 * @param {Array.<String>} params.paths - One or more paths to watch.
	 * @param {String} params.type - The type of subscription.
	 * @access private
	 */
	watch({ debounce, depth, handler, paths, type }) {
		const callback = debounce ? debouncer(handler) : handler;

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
								callback(data.message);
							}
						})
						.on('end', () => {
							if (sid && this.subscriptions[type]) {
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
		if (!this.subscriptions[type]) {
			return;
		}

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

		if (!Object.keys(this.subscriptions[type]).length) {
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
