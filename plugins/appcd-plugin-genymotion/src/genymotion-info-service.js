import DetectEngine from 'appcd-detect';
import gawk from 'gawk';
import path from 'path';
import fs from 'fs';

import { DataServiceDispatcher } from 'appcd-dispatcher';
import { exe } from 'appcd-subprocess';
import { sleep } from 'appcd-util';

import { genymotionLocations, detect as genyDetect, getEmulators } from './genymotion';
import { virtualBoxLocations, VirtualBox } from './virtualbox';

const GENYMOTION_HOME = 1;

/**
 * The iOS info service.
 */
export default class GenymotionInfoService extends DataServiceDispatcher {
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
			emulators: [],
			executables: {},
			home: null,
			path: null,
			version: null,
			virtualbox: {},
		});

		this.genyEngine = new DetectEngine({
			checkDir:             this.checkGenyDir.bind(this),
			depth:                1,
			exe:                  `genymotion${exe}`,
			multiple:             false,
			paths:                genymotionLocations[process.platform],
			processResults:       this.processResults.bind(this),
			redetect:             true,
			refreshPathsInterval: 5000,
			// registryCallback:     this.registryCallback.bind(this),
			watch:                true
		});

		this.genyEngine.on('results', results => {
			results.virtualbox = this.data.virtualbox || {};

			this.watch({
				type: GENYMOTION_HOME,
				paths : [ path.join(results.home, 'deployed') ],
				depth: 3,
				resursive: true,
				handler: async (file) => {
					if (file.action !== 'delete' && !fs.existsSync(path.join(file.file, `${file.filename}.vbox`))) {
						await sleep(10000);
					}
					gawk.set(this.data.emulators, await getEmulators(this.data.virtualbox || {}));

				}
			});

			gawk.set(this.data, results);
		});

		this.vboxEngine = new DetectEngine({
			checkDir(dir) {
				try {
					return new VirtualBox(dir);
				} catch (e) {
					// Squelch
				}
			},
			depth:                1,
			exe:                  `vboxmanage${exe}`,
			multiple:             false,
			paths:                virtualBoxLocations[process.platform],
			processResults:       this.processResults.bind(this),
			redetect:             true,
			refreshPathsInterval: 5000,
			watch:                true
		});

		this.vboxEngine.on('results', async results => {
			gawk.set(this.data.virtualbox, results);
		});

		await this.vboxEngine.start();
		await this.genyEngine.start();
	}

	/**
	 * Determines if the specified directory is a Genymotion install.
	 *
	 * @param {String} dir - The directory to check.
	 * @returns {Promise}
	 * @access private
	 */
	async checkGenyDir(dir) {
		try {
			return await genyDetect(dir);
		} catch (e) {
			// squelch
		}
	}

	/**
	 *
	 * @param {Object} results - The results object
	 * @param {DetectEngine} engine - The detect engine instance.
	 * @access private
	 */
	processResults(results, engine) {
		return;
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
	 * Stops the Genymotion-related environment watchers.
	 *
	 * @returns {Promise}
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
