import DetectEngine from 'appcd-detect';
import gawk from 'gawk';
import path from 'path';
import version from './version';

import * as ioslib from 'ioslib';

import { DataServiceDispatcher } from 'appcd-dispatcher';
import { debounce as debouncer, mergeDeep } from 'appcd-util';

/**
 * Constants to identify the subscription id list.
 * @type {Number}
 */
const KEYCHAIN_META_FILE          = 1;
const KEYCHAIN_PATHS              = 2;
const PROVISIONING_PROFILES_DIR   = 3;
const GLOBAL_SIM_PROFILES         = 4;
const CORE_SIMULATOR_DEVICES_PATH = 5;
const XCODE_SELECT_LINK           = 6;

/**
 * The iOS info service.
 */
export default class iOSInfoService extends DataServiceDispatcher {
	/**
	 * Starts the detect all macOS and iOS related information.
	 *
	 * @param {Config} cfg - An Appc Daemon config object.
	 * @returns {Promise}
	 * @access public
	 */
	async activate(cfg) {
		this.config = cfg;

		this.data = gawk({
			certs: {},
			devices: [],
			keychains: [],
			provisioning: {},
			simulatorDevicePairCompatibility: ioslib.simulator.devicePairCompatibility,
			simulators: {},
			teams: {},
			xcode: {}
		});

		/**
		 * A map of buckets to a list of active fs watch subscription ids.
		 * @type {Object}
		 */
		this.subscriptions = {};

		/**
		 * A gawked array of `Simulator` instances. When this changes, it triggers a regeneration
		 * of the final list of simulators.
		 * @type {Array<Simulator>}
		 */
		this.simulators = gawk([]);

		if (cfg.ios) {
			mergeDeep(ioslib.options, cfg.ios);
		}

		await Promise.all([
			this.initCerts(),
			this.initDevices(),
			this.initKeychains(),
			this.initProvisioningProfiles(),
			this.initTeams(),
			this.initXcodes(),
			this.initSimulators()
		]);

		const regen = debouncer(() => this.regenerateSimulators());
		gawk.watch(this.data.xcode, regen);
		gawk.watch(this.simulators, regen);
		this.regenerateSimulators();
	}

	/**
	 * Detects installed certificates.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async initCerts() {
		this.data.certs = await ioslib.certs.getCerts(true);
	}

	/**
	 * Starts watching for iOS devices being connected and disconnected.
	 */
	initDevices() {
		this.trackDeviceHandle = ioslib.devices
			.trackDevices()
			.on('devices', devices => {
				console.log('Devices changed');
				gawk.set(this.data.devices, devices);
			})
			.on('error', err => {
				console.log('Track devices returned error: %s', err.message);
			});
	}

	/**
	 * Detects keychains and watches the keychain paths for changes.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async initKeychains() {
		this.data.keychains = await ioslib.keychains.getKeychains(true);

		this.watch({
			type: KEYCHAIN_META_FILE,
			paths: [ ioslib.keychains.keychainMetaFile ],
			debounce: true,
			handler: async () => {
				console.log('Keychain plist changed, refreshing keychains and possibly certs');

				const keychains = await ioslib.keychains.getKeychains(true);

				// did the keychains change?
				if (JSON.stringify(this.data.keychains) !== JSON.stringify(keychains)) {
					const k = this.data.keychains;
					k.splice.apply(k, [ 0, k.length ].concat(keychains));

					// get a list of all existing subscriptions
					const sids = this.subscriptions[KEYCHAIN_PATHS] ? Object.keys(this.subscriptions[KEYCHAIN_PATHS]) : [];

					// watch the new paths before unsubscribing from the existing watchers so that we
					// don't have to teardown all of the watchers and re-initialize them
					this.watchKeychainPaths();

					// unwatch the old subscriptions
					await this.unwatch(KEYCHAIN_PATHS, sids);

					console.log('Refreshing certs');
					gawk.set(this.data.certs, await ioslib.certs.getCerts(true));
				}
			}
		});

		this.watchKeychainPaths();
	}

	/**
	 * Watches the keychain paths for changes and when the keychain paths change, it refreshes the
	 * certificates.
	 *
	 * @access private
	 */
	watchKeychainPaths() {
		this.watch({
			type: KEYCHAIN_PATHS,
			paths: this.data.keychains.map(k => k.path),
			debounce: true,
			handler: async () => {
				console.log('Refreshing certs');
				gawk.set(this.data.certs, await ioslib.certs.getCerts(true));
			}
		});
	}

	/**
	 * Detects installed certificates.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async initProvisioningProfiles() {
		gawk.set(this.data.provisioning, await ioslib.provisioning.getProvisioningProfiles(true));

		this.watch({
			type: PROVISIONING_PROFILES_DIR,
			paths: [ ioslib.provisioning.getProvisioningProfileDir() ],
			handler(message) {
				return Promise.resolve()
					.then(async () => {
						const { provisioning } = this.data;

						if (message.action === 'delete') {
							// find the provisioning file in the data store and remove it
							for (const type of Object.keys(provisioning)) {
								for (let i = 0, len = provisioning[type].length; i < len; i++) {
									if (provisioning[type][i].file === message.file) {
										console.log('Removing provisioning profile:', message.file);
										provisioning[type].splice(i, 1);
										return provisioning;
									}
								}
							}

							// couldn't find it, so return
							return;
						}

						// add or change
						try {
							const profile = await ioslib.provisioning.parseProvisioningProfileFile(message.file);
							if (!provisioning[profile.type]) {
								provisioning[profile.type] = {};
							}

							if (message.action === 'change') {
								// try to find the original
								for (const pp of provisioning[profile.type]) {
									if (pp.file === message.file) {
										console.log('Updating provisioning profile:', message.file);
										gawk.set(pp, profile);
										return provisioning;
									}
								}
							}

							console.log('Adding provisioning profile:', message.file);
							provisioning[profile.type].push(profile);
							return provisioning;
						} catch (ex) {
							// squelch
						}
					})
					.then(provisioning => {
						// if the list of provisioning profiles was changed, then rebuild the list of teams
						if (provisioning) {
							console.log('Refreshing teams');
							gawk.set(this.data.teams, ioslib.teams.buildTeamsFromProvisioningProfiles(provisioning));
						}
					});
			}
		});
	}

	/**
	 * Retreives the list of teams.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async initTeams() {
		gawk.set(this.data.teams, await ioslib.teams.getTeams(true));
	}

	/**
	 * Finds all Xcodes and wires up watchers.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async initXcodes() {
		const paths = [ ...ioslib.xcode.xcodeLocations ];
		const defaultPath = await ioslib.xcode.getDefaultXcodePath();
		if (defaultPath) {
			paths.unshift(defaultPath);
		}

		this.xcodeDetectEngine = new DetectEngine({
			checkDir(dir) {
				try {
					return new ioslib.xcode.Xcode(dir);
				} catch (e) {
					// 'dir' is not an Xcode
				}
			},
			depth: 1,
			multiple: true,
			paths,
			async processResults(results, engine) {
				if (results.length > 1) {
					results.sort((a, b) => {
						let r = version.compare(a.version, b.version);
						if (r !== 0) {
							return r;
						}
						return a.build.localeCompare(b.build);
					});
				}

				if (results.length) {
					const defaultPath = await ioslib.xcode.getDefaultXcodePath();
					let foundDefault = false;
					if (defaultPath) {
						for (const xcode of results) {
							if (!foundDefault && defaultPath === xcode.xcodeapp) {
								xcode.default = true;
								foundDefault = true;
							} else {
								xcode.default = false;
							}
						}
					}
					if (!foundDefault) {
						results[results.length - 1].default = true;
					}
				}
			},
			redetect: true,
			watch: true
		});

		// listen for xcode results
		this.xcodeDetectEngine.on('results', results => {
			const xcodes = {};
			const xcodeIds = new Set(Object.keys(this.data.xcode));

			// convert the array of Xcodes into an object of Xcode ids to the xcode info
			// also start watching this Xcode's SDKs and simProfiles
			for (const xcode of results) {
				xcodes[xcode.id] = xcode;
				xcodeIds.delete(xcode.id);

				if (!this.subscriptions.hasOwnProperty(xcode.id)) {
					this.subscriptions[xcode.id] = {};

					const paths = [
						// sdks
						path.join(xcode.path, 'Platforms/iPhoneOS.platform/Developer/SDKs'),
						path.join(xcode.path, 'Platforms/WatchOS.platform/Developer/SDKs')
					];

					// device types and runtimes
					for (const name of [ 'iPhoneSimulator', 'iPhoneOS', 'WatchSimulator', 'WatchOS' ]) {
						paths.push(path.join(xcode.path, `Platforms/${name}.platform/Developer/Library/CoreSimulator/Profiles/DeviceTypes`));
						paths.push(path.join(xcode.path, `Platforms/${name}.platform/Developer/Library/CoreSimulator/Profiles/Runtimes`));
					}

					this.watch({
						type: xcode.id,
						paths,
						debounce: true,
						handler() {
							this.xcodeDetectEngine.rescan();
						}
					});
				}
			}

			for (const id of xcodeIds) {
				this.unwatch(id);
			}

			gawk.set(this.data.xcode, xcodes);
		});

		// watch the global simulator profiles directory for changes
		this.watch({
			type: GLOBAL_SIM_PROFILES,
			paths: [ ioslib.xcode.globalSimProfilesPath ],
			debounce: true,
			handler: () => {
				console.log('Global sim profiles directory changed, rescanning Xcodes');
				this.xcodeDetectEngine.rescan();
			}
		});

		this.watch({
			type: XCODE_SELECT_LINK,
			paths: [ '/private/var/db/xcode_select_link' ],
			debounce: true,
			handler: () => {
				console.log('xcode-select link changed, rescanning Xcodes');
				this.xcodeDetectEngine.rescan();
			}
		});

		return this.xcodeDetectEngine.start();
	}

	/**
	 * Finds all simulators and wires up watchers.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async initSimulators() {
		this.watch({
			type: CORE_SIMULATOR_DEVICES_PATH,
			paths: [ ioslib.simulator.getDevicesDir() ],
			depth: 1,
			debounce: true,
			handler: async () => {
				console.log('Detected filesystem change in the CoreSimulator/Devices directory, rescanning simulators');
				gawk.set(this.simulators, await ioslib.simulator.getSimulators({ force: true }));
			}
		});

		const sims = await ioslib.simulator.getSimulators({ force: true });
		gawk.set(this.simulators, sims);
	}

	/**
	 * Generates an object of discovered simulators based on the detected Xcodes and simulators.
	 *
	 * @access private
	 */
	regenerateSimulators() {
		if (!this.regenerating) {
			this.regenerating = true;

			console.log(`Regenerating simulator registry using ${Object.keys(this.data.xcode).length} Xcodes and ${this.simulators.length} simulators`);

			const registry = ioslib.simulator.generateSimulatorRegistry({
				simulators: this.simulators,
				xcodes:     this.data.xcode
			});

			gawk.set(this.data.simulators, registry);
			this.regenerating = false;
		}
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
	 * @returns {Promise}
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
	 * Stops the iOS-related environment watchers.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async deactivate() {
		if (this.trackDeviceHandle) {
			this.trackDeviceHandle.stop();
			this.trackDeviceHandle = null;
		}

		if (this.xcodeDetectEngine) {
			await this.xcodeDetectEngine.stop();
			this.xcodeDetectEngine = null;
		}

		if (this.subscriptions) {
			for (const type of Object.keys(this.subscriptions)) {
				await this.unwatch(type);
			}
		}
	}
}
