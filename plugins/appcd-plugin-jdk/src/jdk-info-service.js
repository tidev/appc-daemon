import DetectEngine from 'appcd-detect';
import gawk from 'gawk';

import * as registry from 'appcd-winreg';

import { DataServiceDispatcher } from 'appcd-dispatcher';
import { detect, jdkLocations } from 'jdklib';
import { exe } from 'appcd-subprocess';

const version = {
	compare(a, b) {
		return a === b ? 0 : a < b ? -1 : 1;
	}
};

/**
 * The JDK info service.
 */
export default class JDKInfoService extends DataServiceDispatcher {
	/**
	 * Starts the detect engine.
	 *
	 * @param {Config} cfg - An Appc Daemon config object
	 * @returns {Promise}
	 * @access public
	 */
	async activate(cfg) {
		this.data = gawk([]);

		this.engine = new DetectEngine({
			checkDir:             this.checkDir.bind(this),
			depth:                1,
			env:                  'JAVA_HOME',
			exe:                  `javac${exe}`,
			multiple:             true,
			paths:                jdkLocations[process.platform],
			processResults:       this.processResults.bind(this),
			redetect:             true,
			refreshPathsInterval: 15000,
			registryCallback:     this.registryCallback.bind(this),
			watch:                true
		});

		this.engine.on('results', results => {
			gawk.set(this.data, results);
		});

		await this.engine.start();
	}

	/**
	 * Stops the detect engine.
	 *
	 * @access public
	 */
	async deactivate() {
		if (this.engine) {
			await this.engine.stop();
			this.engine = null;
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
		} catch (e) {
			// `dir` is not a jdk
		}
	}

	/**
	 * Sorts the JDKs and assigns a default.
	 *
	 * @param {Array.<JDK>} results - An array of JDKs.
	 * @param {DetectEngine} engine - The detect engine instance.
	 * @access private
	 */
	processResults(results, engine) {
		// sort the jdks
		if (results.length > 1) {
			results.sort((a, b) => {
				let r = version.compare(a.version, b.version);
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
		if (results.length) {
			let foundDefault = false;
			for (const result of results) {
				if (!foundDefault && (!engine.defaultPath || result.path === engine.defaultPath)) {
					result.default = true;
					foundDefault = true;
				} else {
					result.default = false;
				}
			}

			// no default found the system path, so just select the last/newest one as the default
			if (!foundDefault) {
				results[results.length - 1].default = true;
			}
		}
	}

	/**
	 * Scans the Windows Registry for JDK paths to search.
	 *
	 * @returns {Promise} Resolves object containing an array of paths and a default path.
	 * @access private
	 */
	registryCallback() {
		const scanRegistry = async (key) => {
			// try to get the current version, but if this fails, no biggie
			let currentVersion;
			try {
				currentVersion = await registry.get('HKLM', key, 'CurrentVersion');
			} catch (ex) {
				// squelch
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
				// squelch
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
}
