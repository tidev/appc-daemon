import DetectEngine from 'appcd-detect';
import gawk from 'gawk';

import * as registry from 'appcd-winreg';

import { codes } from 'appcd-response';
import { detect, jdkLocations } from 'jdklib';
import { DispatcherError, ServiceDispatcher } from 'appcd-dispatcher';
import { exe } from 'appcd-subprocess';

/**
 * The JDK info service.
 */
export default class JDKInfoService extends ServiceDispatcher {
	/**
	 * Initializes the service path.
	 */
	constructor() {
		super('/:filter*');
	}

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

		this.jdks = gawk([]);

		return new Promise((resolve, reject) => {
			this.handle = engine
				.detect({
					watch: true,
					redetect: true
				})
				.on('results', jdks => {
					this.jdks.splice.apply(this.jdks, [ 0, this.jdks.length ].concat(jdks));
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
	async deactivate() {
		if (this.handle) {
			await this.handle.stop();
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
	 * Sorts the JDKs and assigns a default.
	 *
	 * @param {Array.<JDK>} jdks - An array of JDKs.
	 * @param {Array.<JDK>|undefined} previousValue - The previous value or `undefined` if there is
	 * no previous value.
	 * @param {DetectEngine} engine - The detect engine instance.
	 * @access private
	 */
	processResults(jdks, previousValue, engine) {
		// sort the jdks
		if (jdks.length > 1) {
			jdks.sort((a, b) => {
				let r = 0; // version.compare(a.version, b.version);
				if (r !== 0) {
					return r;
				}

				r = (a.build || 0) - (b.build || 0);
				if (r !== 0) {
					return r;
				}
				return a.arch.localeCompare(b.arch);
			});
		}

		// loop over all of the new jdks and set default version
		let foundDefault = false;
		for (const result of jdks) {
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
		const scanRegistry = async (key) => {
			// try to get the current version, but if this fails, no biggie
			let currentVersion;
			try {
				currentVersion = await registry.get('HKLM', key, 'CurrentVersion');
			} catch (ex) {
				// squeltch
			}
			const defaultKey = currentVersion && `${key}\\${currentVersion}`;

			// get all subkeys which should only be valid JDKs
			try {
				const keys = await registry.keys('HKLM', key);
				return Promise
					.all(keys.map(async (key) => {
						const javaHome = await registry.get('HKLM', key, 'JavaHome');
						if (javaHome) {
							console.log(`found JavaHome: ${javaHome}`);
							return { [javaHome]: key === defaultKey };
						}
					}))
					.then(jdks => Object.assign.apply(null, jdks))
					.catch(() => ({}));
			} catch (ex) {
				// squeltch
			}
		};

		console.log('checking Windows registry for JavaHome paths');

		return Promise
			.all([
				scanRegistry('\\Software\\JavaSoft\\Java Development Kit'),
				scanRegistry('\\Software\\Wow6432Node\\JavaSoft\\Java Development Kit'),
				scanRegistry('\\Software\\JavaSoft\\JDK')
			])
			.then(results => {
				results = Object.assign.apply(null, results);
				return {
					paths: Object.keys(results),
					defaultPath: Object.keys(results).filter(key => results[key])[0]
				};
			})
			.catch(() => ({}));
	}

	/**
	 * Responds to "call" service requests.
	 *
	 * @param {Object} ctx - A dispatcher request context.
	 * @access private
	 */
	onCall(ctx) {
		const filter = ctx.params.filter && ctx.params.filter.replace(/^\//, '').split(/\.|\//) || undefined;
		const node = this.get(filter);
		if (!node) {
			throw new DispatcherError(codes.NOT_FOUND);
		}
		ctx.response = node;
	}

	/**
	 * Responds to "subscribe" service requests.
	 *
	 * @param {Object} ctx - A dispatcher request context.
	 * @param {Function} publish - A function used to publish data to a dispatcher client.
	 * @access private
	 */
	onSubscribe(ctx, publish) {
		const filter = ctx.params.filter && ctx.params.filter.replace(/^\//, '').split(/\.|\//) || undefined;

		const node = this.get(filter);
		publish(node);

		console.log('Starting gawk watch: %s', filter ? filter.join('/') : 'no filter');
		gawk.watch(this.jdks, filter, publish);
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
		console.log('Removing gawk watch');
		gawk.unwatch(this.jdks, publish);
	}

	/**
	 * Returns the complete or filtered status values.
	 *
	 * @param {Array.<String>} [filter] - An array of namespaces used to filter and return a deep
	 * object.
	 * @return {*}
	 * @access private
	 */
	get(filter) {
		if (filter && !Array.isArray(filter)) {
			throw new TypeError('Expected filter to be an array');
		}

		let obj = this.jdks;

		if (filter) {
			for (let i = 0, len = filter.length; obj && typeof obj === 'object' && i < len; i++) {
				if (!obj.hasOwnProperty(filter[i])) {
					return null;
				}
				obj = obj[filter[i]];
			}
		}

		return obj;
	}
}
