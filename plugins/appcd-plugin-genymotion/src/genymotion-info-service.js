import DetectEngine from 'appcd-detect';
import gawk from 'gawk';
import path from 'path';

import { DataServiceDispatcher } from 'appcd-dispatcher';
import { debounce as debouncer, get } from 'appcd-util';
import { exe } from 'appcd-subprocess';
import { genymotion, virtualbox } from 'androidlib';

const VIRTUALBOX_CONFIG = 1;
const VM_CONFIG = 2;

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

		this.virtualbox = null;

		this.data = gawk({
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

		const refreshVirtualBoxEmulators = () => {
			const emulators = this.virtualbox.list();

			gawk.set(
				this.data.emulators,
				emulators
					.filter(vm => vm.props.genymotion_version)
					.map(vm => new genymotion.GenymotionEmulator(vm))
			);

			const sids = this.subscriptions[VM_CONFIG] ? Object.keys(this.subscriptions[VM_CONFIG]) : [];

			this.watch({
				type: VM_CONFIG,
				paths: emulators.map(vm => path.join(vm.path, `${vm.name}.vbox`)),
				debounce: true,
				handler: () => {
					console.log('A virtual machine config changed, rescanning genymotion emulators');
					gawk.set(
						this.data.emulators,
						this.virtualbox.list()
							.filter(vm => vm.props.genymotion_version)
							.map(vm => new genymotion.GenymotionEmulator(vm))
					);
				}
			});

			this.unwatch(VM_CONFIG, sids);
		};

		this.vboxEngine.on('results', vbox => {
			this.virtualbox = vbox;
			refreshVirtualBoxEmulators();
		});

		const vboxConfig = virtualbox.virtualBoxConfigFile[process.platform];
		this.watch({
			type: VIRTUALBOX_CONFIG,
			paths: [ vboxConfig ],
			debounce: true,
			handler: () => {
				console.log(`${vboxConfig} changed, rescanning genymotion emulators`);
				refreshVirtualBoxEmulators();
			}
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
			checkDir(dir) {
				try {
					return new genymotion.Genymotion(dir);
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
			gawk.set(this.data, results);
		});

		await this.genyEngine.start();
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
