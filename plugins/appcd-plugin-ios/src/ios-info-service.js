import DetectEngine from 'appcd-detect';
import gawk from 'gawk';
import path from 'path';

import * as ioslib from 'ioslib';

import { DataServiceDispatcher } from 'appcd-dispatcher';
import { get, mergeDeep } from 'appcd-util';

/**
 * Constants to identify the subscription id list.
 * @type {Number}
 */
const KEYCHAIN_META_FILE          = 1;
const KEYCHAIN_PATHS              = 2;
const PROVISIONING_PROFILES_DIR   = 3;
const GLOBAL_SIM_PROFILES         = 4;
const CORE_SIMULATOR_DEVICES_PATH = 5;

const version = {
	compare(a, b) {
		return a === b ? 0 : a < b ? -1 : 1;
	}
};

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
			simulators: {},
			teams: {},
			xcode: {}
		});

		/**
		 * A map of buckets to a list of active fs watch subscription ids.
		 * @type {Object}
		 */
		this.subscriptions = {};

		if (cfg.ios) {
			mergeDeep(ioslib.options, cfg.ios);
		}

		await this.initCerts();
		this.initDevices();
		await this.initKeychains();
		await this.initProvisioningProfiles();
		await this.initTeams();
		await this.initXcodeAndSimulators();
	}

	/**
	 * Detects installed certificates.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async initCerts() {
		this.data.certs = await ioslib.certs.getCerts(true);
		this.watchKeychainPaths();
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
	 */
	async initTeams() {
		gawk.set(this.data.teams, await ioslib.teams.getTeams(true));
	}

	/**
	 * Finds all Xcode installations.
	 *
	 * @returns {Promise}
	 */
	async initXcodeAndSimulators() {
		const paths = [ ...ioslib.xcode.xcodeLocations ];
		const defaultPath = await ioslib.xcode.getDefaultXcodePath(get(this.config, 'ios.executables.xcodeselect'));
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
			processResults: async (results, engine) => {
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
					const defaultPath = await ioslib.xcode.getDefaultXcodePath(get(this.config, 'ios.executables.xcodeselect'));
					let foundDefault = false;
					if (defaultPath) {
						for (const xcode of results) {
							if (!foundDefault && defaultPath === xcode.path) {
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
			const obj = {};
			const xcodeIds = new Set(Object.keys(this.data.xcode));

			// convert the array of Xcodes into an object of Xcode ids to the xcode info
			// also start watching this Xcode's SDKs and simProfiles
			for (const xcode of results) {
				obj[xcode.id] = xcode;
				xcodeIds.delete(xcode.id);

				if (!this.subscriptions[xcode.id]) {
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
						handler() {
							this.xcodeDetectEngine.rescan();
						}
					});
				}
			}

			for (const id of xcodeIds) {
				this.unwatch(id);
			}

			gawk.set(this.data.xcode, obj);
		});

		// if xcodes change, then refresh the simulators
		gawk.watch(this.data.xcode, async (xcodeInfo) => {
			gawk.set(this.data.simulators, await ioslib.simulator.getSimulators(xcodeInfo));
		});

		// watch the global simulator profiles directory for changes
		this.watch({
			type: GLOBAL_SIM_PROFILES,
			paths: [ ioslib.xcode.globalSimProfilesPath ],
			handler() {
				this.xcodeDetectEngine.rescan();
			}
		});

		this.watch({
			type: CORE_SIMULATOR_DEVICES_PATH,
			paths: [ ioslib.simulator.getCoreSimulatorDevicesDir() ],
			depth: 1,
			handler: async () => {
				gawk.set(this.data.simulators, await ioslib.simulator.getSimulators(this.data.xcode));
			}
		});

		// detect the Xcodes which in turn will detect the simulators
		await this.xcodeDetectEngine.start();
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
				data.depth = 1;
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
	 * @returns {Promise}
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
