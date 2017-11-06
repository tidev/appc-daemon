import DetectEngine from 'appcd-detect';
import gawk from 'gawk';
import path from 'path';

import * as ioslib from 'ioslib2';

import { DataServiceDispatcher } from 'appcd-dispatcher';
import { run, which } from 'appcd-subprocess';

const KEYCHAIN_META_FILE = 1;
const KEYCHAIN_PATHS = 2;
const PROVISIONING_PROFILES_DIR = 3;

/**
 * The iOS info service.
 */
export default class iOSInfoService extends DataServiceDispatcher {
	/**
	 * Starts the detect all macOS and iOS related information.
	 *
	 * @param {Config} cfg - An Appc Daemon config object
	 * @returns {Promise}
	 * @access public
	 */
	async activate(cfg) {
		this.cfg = cfg;

		this.data = gawk({
			certs: {},
			devices: [],
			keychains: [],
			provisioning: {},
			simulators: {},
			teams: {},
			xcode: {}
		});

		this.subscriptions = {};

		if (cfg.ios) {
			Object.assign(ioslib.options.executables, cfg.ios.executables);
		}

		await this.initCerts();
		this.initDevices();
		await this.initKeychains();
		await this.initProvisioningProfiles();
		await this.initTeams();
		await this.initXcodes();
	}

	/**
	 * Detects installed certificates.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async initCerts() {
		this.data.certs = await ioslib.certs.getCerts();
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
		this.data.keychains = await ioslib.keychains.getKeychains();

		this.watch(KEYCHAIN_META_FILE, [ ioslib.keychains.keychainMetaFile ], async () => {
			console.log('Keychain plist changed, refreshing keychains and possibly certs');

			const keychains = await ioslib.keychains.getKeychains();

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
				gawk.set(this.data.certs, await ioslib.certs.getCerts());
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
		this.watch(KEYCHAIN_PATHS, this.data.keychains.map(k => k.path), async () => {
			console.log('Refreshing certs');
			gawk.set(this.data.certs, await ioslib.certs.getCerts());
		});
	}

	/**
	 * Detects installed certificates.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async initProvisioningProfiles() {
		gawk.set(this.data.provisioning, await ioslib.provisioning.getProvisioningProfiles());

		this.watch(PROVISIONING_PROFILES_DIR, [ ioslib.provisioning.getProvisioningProfileDir() ], message => {
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
		});
	}

	/**
	 * Retreives the list of teams.
	 *
	 * @returns {Promise}
	 */
	async initTeams() {
		gawk.set(this.data.teams, await ioslib.teams.getTeams());
	}

	/**
	 * Finds all Xcode installations.
	 *
	 * @returns {Promise}
	 */
	async initXcodes() {
		let xcodeSelect;
		try {
			xcodeSelect = await which('xcode-select');
		} catch (e) {
			// squelch
		}

		const paths = [ ...ioslib.xcode.xcodeLocations ];
		let defaultPath = null;

		if (xcodeSelect) {
			try {
				const { stdout } = await run(xcodeSelect, [ '--print-path' ]);
				defaultPath = path.dirname(path.dirname(stdout.trim()));
				paths.unshift(defaultPath);
			} catch (e) {
				// squelch
			}
		}

		this.xcodeDetectEngine = new DetectEngine({
			checkDir(dir) {
				try {
					return new ioslib.xcode.Xcode(dir);
				} catch (e) {
					// 'dir' is not an Xcode
					if (dir === '/Applications/Xcode.app') {
						console.error(e);
					}
				}
			},
			depth: 1,
			multiple: true,
			paths,
			processResults(results, engine) {
				//
			},
			redetect: true,
			watch: true
		});

		this.xcodeDetectEngine.on('results', results => {
			gawk.set(this.data.xcode, results);
		});

		await this.xcodeDetectEngine.start();
	}

	/**
	 * Subscribes to filesystem events for the specified paths.
	 *
	 * @param {String} type - The type of subscription.
	 * @param {Array.<String>} paths - One or more paths to watch.
	 * @param {Function} handler - A callback function to fire when a fs event occurs.
	 * @access private
	 */
	watch(type, paths, handler) {
		for (const path of paths) {
			appcd
				.call('/appcd/fswatch', {
					data: { path },
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
	 * @param {Array.<String>} sids - An array of subscription ids to unsubscribe.
	 * @returns {Promise}
	 * @access private
	 */
	async unwatch(type, sids) {
		for (const sid of sids) {
			await appcd.call('/appcd/fswatch', {
				sid,
				type: 'unsubscribe'
			});

			delete this.subscriptions[type][sid];
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
				await this.unwatch(type, Object.keys(this.subscriptions[type]));
			}
		}
	}
}
