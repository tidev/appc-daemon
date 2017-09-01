import DetectEngine from 'appcd-detect';
import gawk from 'gawk';

import { detect, jdkLocations } from 'jdklib';
import { exe } from 'appcd-subprocess';
import { ServiceDispatcher } from 'appcd-dispatcher';

/**
 * The JDK info service.
 */
export default class JDKInfoService extends ServiceDispatcher {
	/**
	 * Starts the detect engine.
	 *
	 * @param {Config} cfg - An Appc Daemon config object
	 * @returns {Promise}
	 * @access public
	 */
	activate(cfg) {
		const engine = new DetectEngine({
			checkDir:             this.checkDir.bind(this),
			depth:                1,
			env:                  'JAVA_HOME',
			exe:                  `javac${exe}`,
			multiple:             true,
			processResults:       this.processResults.bind(this),
			registryKeys:         this.scanRegistry.bind(this),
			registryPollInterval: 15000,
			paths:                jdkLocations[process.platform]
		});

		this.results = gawk([]);

		return new Promise((resolve, reject) => {
			this.handle = engine
				.detect({
					watch: true,
					redetect: true
				})
				.on('results', results => {
					this.results.splice.apply(this.results, [ 0, this.results.length ].concat(results));
					resolve();
				})
				.on('error', err => {
					console.error(err);
					reject(err);
				});
		});
	}

	/**
	 * Stops the detect engine.
	 *
	 * @access public
	 */
	deactivate() {
		if (this.handle) {
			this.handle.stop();
			this.handle = null;
		}
	}

	/**
	 * Determines if the specified directory contains a JDK and if so, returns the JDK info.
	 *
	 * @param {String} dir - The directory to check.
	 * @returns {Promise}
	 * @access private
	 */
	async checkDir(dir) {
		try {
			return await detect(dir);
		} catch (ex) {
			// `dir` is not a jdk
		}
	}

	/**
	 * Sorts the results and assigns a default.
	 *
	 * @param {Array.<JDK>} results - An array of results.
	 * @param {Array.<JDK>|undefined} previousValue - The previous value or `undefined` if there is
	 * no previous value.
	 * @param {DetectEngine} engine - The detect engine instance.
	 * @access private
	 */
	processResults(results, previousValue, engine) {
		// sort the results
		if (results.length > 1) {
			results.sort((a, b) => {
				let r = 0; // version.compare(a.version, b.version);
				if (r !== 0) {
					return r;
				}

				r = (a.build || 0) - (b.build || 0);
				if (r !== 0) {
					return r;
				}

				return a.architecture.localeCompare(b.architecture);
			});
		}

		// loop over all of the new results and set default version
		let foundDefault = false;
		for (const result of results) {
			if (!foundDefault && (!engine.defaultPath || result.path === engine.defaultPath)) {
				result.default = true;
				foundDefault = true;
			} else {
				result.default = false;
			}
		}
	}

	/**
	 * Scans the Windows Registry for JDK paths to search.
	 *
	 * @returns {Promise} Resolves object containing an array of paths and a default path.
	 * @access private
	 */
	scanRegistry() {
		/*
		const results = {};
		const scanRegistry = key => {
			// try to get the current version, but if this fails, no biggie
			return appc.windows.registry.get('HKLM', key, 'CurrentVersion')
				.then(currentVersion => currentVersion && `${key}\\${currentVersion}`)
				.catch(err => Promise.resolve())
				.then(defaultKey => {
					// get all subkeys which should only be valid JDKs
					return appc.windows.registry.keys('HKLM', key)
						.then(keys => Promise.all(keys.map(key => {
							return appc.windows.registry.get('HKLM', key, 'JavaHome')
								.then(javaHome => {
									if (javaHome && !results.hasOwnProperty(javaHome)) {
										log(`found JavaHome: ${javaHome}`);
										results[javaHome] = key === defaultKey;
									}
								})
								.catch(err => Promise.resolve());
						})));
				})
				.catch(err => Promise.resolve());
		};

		log('checking Windows registry for JavaHome paths');

		return Promise
			.all([
				scanRegistry('\\Software\\JavaSoft\\Java Development Kit'),
				scanRegistry('\\Software\\Wow6432Node\\JavaSoft\\Java Development Kit')
			])
			.then(() => ({
				paths: Object.keys(results),
				defaultPath: Object.keys(results).filter(key => results[key])[0]
			}));
		*/
		return Promise.resolve();
	}

	/**
	 * Responds to "call" service requests.
	 *
	 * @param {Object} ctx - A dispatcher request context.
	 * @access private
	 */
	onCall(ctx) {
		ctx.response = this.results;
	}

	/**
	 * Responds to "subscribe" service requests.
	 *
	 * @param {Object} ctx - A dispatcher request context.
	 * @param {Function} publish - A function used to publish data to a dispatcher client.
	 * @access private
	 */
	onSubscribe(ctx, publish) {
		publish(this.results);

		logger.debug('Starting jdk info watch');
		gawk.watch(this.results, filter, publish);
	}

	/**
	 * Responds to "unsubscribe" service requests.
	 *
	 * @param {Object} ctx - A dispatcher request context.
	 * @param {Function} publish - The function used to publish data to a dispatcher client. This is
	 * the same publish function as the one passed to `onSubscribe()`.
	 * @access private
	 */
	onUnsubscribe(ctx, publish) {
		logger.debug('Removing jdk info watch');
		gawk.unwatch(this.results, publish);
	}
}
