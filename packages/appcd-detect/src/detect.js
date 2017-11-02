/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import appcdLogger from 'appcd-logger';
import path from 'path';

import * as winreg from 'appcd-winreg';

import { arrayify, randomBytes } from 'appcd-util';
import { EventEmitter } from 'events';
import { real } from 'appcd-path';
import { which } from 'appcd-subprocess';

const { log, warn } = appcdLogger('appcd:detect');
const { highlight } = appcdLogger.styles;

/**
 * Encapsulates
 */
export default class Detector extends EventEmitter {
	/**
	 * A timer handle used for polling the Windows Registry.
	 * @type {Timeout?}
	 */
	checkRegistryPollTimer = null;

	/**
	 * The default path used to flag a specific results as the preferred default.
	 * @type {String?}
	 */
	defaultPath = null;

	/**
	 * A unique id used for the blocks/mutexes.
	 * @type {String}
	 */
	id = randomBytes(10);

	/**
	 * Used to store the last default path when watching and on a Windows machine. The default path
	 * can change on Windows depending on what is found in the Windows Registry. Using this
	 * property, the engine can determine if the paths have changed and fire a redetect.
	 * @type {String?}
	 */
	lastDefaultPath = null;

	/**
	 * A SHA of the paths found during the last Windows Registry check. If the SHA changes, then the
	 * paths changed and it needs to redetect.
	 * @type {String}
	 */
	lastRegistrySHA = null;

	/**
	 * A cleaned up version of the options passed into the detector constructor.
	 * @type {Object}
	 */
	opts = null;

	/**
	 * A list of all active search paths.
	 * @type {Set}
	 */
	searchPaths = null;

	/**
	 * Initializes the detector instance.
	 *
	 * @param {Object} [opts] - Various detect options.
	 * @param {Function} [opts.checkDir] - A function that is called for each directory when
	 * scanning to check if the specified directory is of interest.
	 * @param {Number} [opts.depth=0] - The max depth to scan each search path.
	 * @param {String|Array<String>|Set} [opts.env] - One or more environment variables containing a
	 * path.
	 * @param {String} [opts.exe] - The name of the executable to search the system path for. If
	 * found, the directory is returned and the value will be marked as the primary path.
	 * @param {Boolean} [opts.multiple=false] - When true, the scanner will continue to scan paths
	 * even after a result has been found.
	 * @param {String|Array<String>|Set} [opts.paths] - One or more global search paths to search.
	 * @param {Boolean} [opts.recursive=false] - When `true`, recursively watches a path for
	 * changes to trigger a redetect.
	 * @param {Boolean} [opts.redetect=false] - When `true`, re-runs detection when a path changes.
	 * Requires `watch` to be `true`.
	 * @param {Function} [opts.processResults] - A function that is called after the scanning is
	 * complete and the results may be modified.
	 * @param {Function} [opts.registryCallback] - A user-defined function that performs its own
	 * Windows Registry checks. The callback may return a promise. The result must be a string
	 * containing a path, an array of paths, or a falsey value if there are no paths to return.
	 * @param {Object|Array<Object>|Set} [opts.registryKeys] - One or more objects containing the
	 * registry `hive`, `key`, and value `name` to query the Windows Registry.
	 * @param {Number} [opts.registryPollInterval=30000] - The number of milliseconds to check for
	 * updates in the Windows Registry. Only used when `detect()` is called with `watch=true`.
	 * @param {Boolean} [opts.watch=false] - When `true`, watches for changes and emits the new
	 * results when a change occurs.
	 * @access public
	 */
	constructor(opts = {}) {
		if (opts.checkDir !== undefined && typeof opts.checkDir !== 'function') {
			throw new TypeError('Expected "checkDir" option to be a function');
		}

		opts.depth = Math.max(~~opts.depth, 0);

		opts.env = arrayify(opts.env, true);
		if (opts.env.some(s => !s || typeof s !== 'string')) {
			throw new TypeError('Expected "env" option to be a string or an array of strings');
		}

		if (opts.exe !== undefined && (typeof opts.exe !== 'string' || !opts.exe)) {
			throw new TypeError('Expected "exe" option to be a non-empty string');
		}

		opts.paths = arrayify(opts.paths, true);
		if (opts.paths.some(s => !s || typeof s !== 'string')) {
			throw new TypeError('Expected "paths" option to be a non-empty string or an array or set of non-empty strings');
		}

		if (opts.processResults !== undefined && typeof opts.processResults !== 'function') {
			throw new TypeError('Expected "processResults" option to be a function');
		}

		opts.redetect = !opts.redetect || opts.watch;

		if (opts.registryCallback !== undefined && typeof opts.registryCallback !== 'function') {
			throw new TypeError('Expected "registryCallback" option to be a function');
		}

		opts.registryKeys = arrayify(opts.registryKeys, true);
		if (opts.registryKeys.some(r => !r || typeof r !== 'object' || Array.isArray(r) || !r.hive || !r.key || !r.name)) {
			throw new TypeError('Expected "registryKeys" option to be an object or array of objects with a "hive", "key", and "name"');
		}

		opts.registryPollInterval = Math.max(~~opts.registryPollInterval || 30000, 0);

		// initialize paths
		opts.paths = new Set(opts.paths);

		// environment paths
		for (const name of opts.env) {
			const dir = process.env[name];
			if (dir) {
				opts.paths.add(dir);
			}
		}

		super();

		this.opts = opts;

		// we grab the first path as the default
		this.defaultPath = opts.paths.values().next().value;
	}

	/**
	 * Initializes the search paths, wires up the filesystem watchers, and performs the initial
	 * scan.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async start() {
		log('Starting scan...');

		// finish the initialization of the original list of paths
		if (this.opts.exe) {
			// we have a executable, so we're going to try to find it using the system PATH
			try {
				const dir = this.defaultPath = path.dirname(real(await which(this.opts.exe)));
				this.opts.paths.add(dir);
			} catch (e) {
				// squeltch
			}
		}

		// initialize the search paths
		this.searchPaths = new Set(this.opts.paths);
		if (process.platform === 'win32') {
			await this.checkRegistry();
		}

		log('  id:',           highlight(this.id));
		log('  recursive:',    highlight(!!this.opts.recursive));
		log('  redetect:',     highlight(!!this.opts.redetect));
		log('  watch:',        highlight(!!this.opts.watch));
		log('  search paths:', highlight(JSON.stringify(this.searchPaths)));
		log('  default path:', highlight(this.defaultPath || 'n/a'));

		// this.lastDefaultPath = this.defaultPath;

		// return results;
	}

	/**
	 * Stops the detection. This method is only required when `watch=true`.
	 *
	 * @access public
	 */
	async stop() {
		if (this.checkRegistryPollTimer) {
			clearTimeout(this.checkRegistryPollTimer);
			this.checkRegistryPollTimer = null;
		}
	}

	/**
	 * Polls the Windows Registry for search paths. This is only invoked on the Windows machines.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async checkRegistry() {
		const paths = new Set();
		let defaultPath = null;

		for (const obj of this.opts.registryKeys) {
			try {
				paths.add(await winreg.get(obj.hive, obj.key, obj.name));
			} catch (e) {
				// squeltch
			}
		}

		if (typeof this.opts.registryCallback === 'function') {
			try {
				const result = await this.opts.registryCallback();
				if (result) {
					if (typeof result === 'string') {
						paths.add(result);
					} else if (typeof result === 'object') {
						for (const dir of arrayify(results.paths, true)) {
							paths.add(dir);
						}
						defaultPath = result.defaultPath || null;
					}
				}
			} catch (e) {
				warn('Registry callback threw error:'
			}
		}

		if (this.opts.watch) {
			this.checkRegistryPollTimer = setTimeout(() => this.checkRegistry(), this.opts.registryPollInterval);
		}

		return { paths, defaultPath };
	}

	// 				log('    Starting scan to see if paths changed');
	// 				log('    paths:', paths);
	// 				const sha = sha1(paths.sort());
	// 				if (handle.lastSha !== sha) {
	// 					log('  Paths changed, rescanning', handle.lastSha, sha);
	// 					handle.lastSha = sha;
	// 					return this.runScan(paths, id, handle, opts);
	// 				} else if (this.lastDefaultPath !== this.defaultPath) {
	// 					log('  Default path changed, rescanning');
	// 					log(`    ${this.lastDefaultPath}`);
	// 					log(`    ${this.defaultPath}`);
	// 					this.lastDefaultPath = this.defaultPath;
	// 					return this.processResults(this.cache[id].results, id);
	// 				}
	// 			})
	// 			.then(() => this.checkRegistry(id, handle, opts))
	// 			.catch(err => handle.die(err));
	// 	}, this.options.registryPollInterval);
	// }
}
