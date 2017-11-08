import DetectEngine from 'appcd-detect';
import gawk from 'gawk';
import path from 'path';

import { DataServiceDispatcher } from 'appcd-dispatcher';
import { exe, run, which } from 'appcd-subprocess';

import { genymotionLocations, detect as genyDetect } from './genymotion';
import { virtualBoxLocations, detect as vboxDetect } from './virtualbox';

let genyStarted = false;
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
			gawk.set(this.data, results);
		});

		this.vboxEngine = new DetectEngine({
			checkDir:             this.checkVBoxDir.bind(this),
			depth:                1,
			exe:                  `vboxmanage${exe}`,
			multiple:             false,
			paths:                virtualBoxLocations[process.platform],
			processResults:       this.processResults.bind(this),
			redetect:             true,
			refreshPathsInterval: 5000,
			// registryCallback:     this.registryCallback.bind(this),
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
			return await genyDetect(dir, this.data.virtualbox.executables.vboxmanage || null);
		} catch (e) {
			// squelch
			console.log(e);
		}
	}

	/**
	 * Determines if the specified directory is a Genymotion install.
	 *
	 * @param {String} dir - The directory to check.
	 * @returns {Promise}
	 * @access private
	 */
	async checkVBoxDir(dir) {
		try {
			return await vboxDetect(dir);
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
	 * Stops the Genymotion-related environment watchers.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async deactivate() {
		if (this.genyEngine) {
			await this.genyEngine.stop();
			this.genyEngine = null;
			genyStarted = false;
		}

		if (this.vboxEngine) {
			await this.vboxEngine.stop();
			this.vboxEngine = null;
		}
	}
}
