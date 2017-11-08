import appcdLogger from 'appcd-logger';
import Detector from './detector';
import gawk from 'gawk';
import path from 'path';

import * as winreg from 'appcd-winreg';

import { arrayify, debounce, randomBytes, tailgate } from 'appcd-util';
import { EventEmitter } from 'events';
import { real } from 'appcd-path';
import { which } from 'appcd-subprocess';

const { log, warn } = appcdLogger('appcd:detect');
const { highlight } = appcdLogger.styles;
const { pluralize } = appcdLogger;

/**
 * A engine for detecting various things. It walks the search paths and calls a `checkDir()`
 * function. The results are accumulated and cached. The engine also supports watching the search
 * paths for changes.
 */
export default class DetectEngine extends EventEmitter {
	/**
	 * The default path used to flag a specific results as the preferred default.
	 * @type {String?}
	 */
	defaultPath = null;

	/**
	 * A map of search paths to detector instances.
	 * @type {Map}
	 */
	detectors = new Map();

	/**
	 * A random id that identifies this detect engine instance when creating tailgates.
	 * @type {String}
	 */
	id = randomBytes(10);

	/**
	 * A cleaned up version of the options passed into the detect engine constructor.
	 * @type {Object}
	 */
	opts = null;

	/**
	 * A timer handle used for refreshing the search paths and polling the Windows Registry.
	 * @type {Timeout?}
	 */
	refreshPathsTimer = null;

	/**
	 * A gawked array containing the results from the scan.
	 * @type {Array.<Object>}
	 */
	results = gawk([]);

	/**
	 * A list of all active search paths.
	 * @type {Set}
	 */
	searchPaths = null;

	/**
	 * Initializes the detect engine instance and validates the options.
	 *
	 * @param {Object} [opts] - Various detect options.
	 * @param {Function} [opts.checkDir] - A function that is called for each directory when
	 * scanning to check if the specified directory is of interest.
	 * @param {Number} [opts.depth=0] - The max depth to scan each search path. Must be greater than
	 * or equal to zero. If the `depth` is `0`, it will not scan subdirectories of each path.
	 * @param {String|Array<String>|Set} [opts.env] - One or more environment variables containing a
	 * path.
	 * @param {String} [opts.exe] - The name of the executable to search the system path for. If
	 * found, the directory is returned and the value will be marked as the primary path.
	 * @param {Boolean} [opts.multiple=false] - When true, the scanner will continue to scan paths
	 * even after a result has been found.
	 * @param {String|Array<String>|Set} [opts.paths] - One or more global search paths to search.
	 * @param {Function} [opts.processResults] - A function that is called after the scanning is
	 * complete and the results may be modified.
	 * @param {Boolean} [opts.recursive=false] - When `true`, recursively watches a path for
	 * changes to trigger a redetect.
	 * @param {Boolean} [opts.redetect=false] - When `true`, re-runs detection when a path changes.
	 * Requires `watch` to be `true`.
	 * @param {Number} [opts.refreshPathsInterval=30000] - The number of milliseconds to check for
	 * updated search and default paths, namely from the Windows Registry. Only used when `detect()`
	 * is called with `watch=true`.
	 * @param {Function} [opts.registryCallback] - A user-defined function that performs its own
	 * Windows Registry checks. The callback may return a promise. The result must be a string
	 * containing a path, an array of paths, or a falsey value if there are no paths to return.
	 * @param {Object|Array<Object>|Set} [opts.registryKeys] - One or more objects containing the
	 * registry `hive`, `key`, and value `name` to query the Windows Registry.
	 * @param {Boolean} [opts.watch=false] - When `true`, watches for changes and emits the new
	 * results when a change occurs.
	 * @access public
	 */
	constructor(opts = {}) {
		if (typeof opts.checkDir !== 'function') {
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

		opts.refreshPathsInterval = Math.max(~~opts.refreshPathsInterval || 30000, 0);

		if (opts.registryCallback !== undefined && typeof opts.registryCallback !== 'function') {
			throw new TypeError('Expected "registryCallback" option to be a function');
		}

		opts.registryKeys = arrayify(opts.registryKeys, true);
		if (opts.registryKeys.some(r => !r || typeof r !== 'object' || Array.isArray(r) || !r.hive || !r.key || !r.name)) {
			throw new TypeError('Expected "registryKeys" option to be an object or array of objects with a "hive", "key", and "name"');
		}

		super();

		this.opts = opts;

		// we need to have at least one 'error' handler
		this.on('error', () => {});

		// wire up result changes to be emitted
		gawk.watch(this.results, results => {
			this.emit('results', opts.multiple ? results : results[0]);
		});
	}

	/**
	 * Recomputes the search and default paths. If they changed, then it triggers a re-scan. This
	 * function will resolve the results from the initial scan.
	 *
	 * @returns {Promise<Array|Object>}
	 * @access public
	 */
	async start() {
		try {
			await this.rescan();
			if (this.opts.watch) {
				this.refreshPaths();
			}
			return this.opts.multiple ? this.results : this.results[0];
		} catch (err) {
			this.emit('error', err);
			throw err;
		}
	}

	/**
	 * Stops the detection. This method is only required when `watch=true`.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async stop() {
		log('stop()');
		if (this.refreshPathsTimer) {
			log('  Cancelling refresh paths timer');
			clearTimeout(this.refreshPathsTimer);
			this.refreshPathsTimer = null;
		}

		log(pluralize(`  Stopping ${highlight(this.detectors.size)} detector`, this.detectors.size));
		for (const detector of this.detectors.values()) {
			await detector.stop();
		}
		this.detectors.clear();
	}

	/**
	 * Forces a rescan.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async rescan() {
		await this.scan(await this.getPaths());
	}

	/**
	 * Determines the list of search paths and the default path.
	 *
	 * @returns {Promise<Object>}
	 * @access private
	 */
	async getPaths() {
		let defaultPath = null;
		let searchPaths = new Set(this.opts.paths.map(dir => real(dir)));

		// environment paths
		for (const name of this.opts.env) {
			const dir = process.env[name];
			if (dir) {
				searchPaths.add(real(dir));
			}
		}

		// we grab the first path as the default
		defaultPath = searchPaths.values().next().value;

		// finish the initialization of the original list of paths
		if (this.opts.exe) {
			// we have a executable, so we're going to try to find it using the system PATH
			try {
				defaultPath = path.dirname(real(await which(this.opts.exe)));
				searchPaths.add(defaultPath);
			} catch (e) {
				// squelch
			}
		}

		if (process.platform === 'win32') {
			await Promise.all(this.opts.registryKeys.map(async (obj) => {
				try {
					searchPaths.add(real(await winreg.get(obj.hive, obj.key, obj.name)));
				} catch (e) {
					warn('Failed to get registry key: %s', e.message);
				}
			}));
		}

		if (typeof this.opts.registryCallback === 'function') {
			try {
				const result = await this.opts.registryCallback();
				if (result && typeof result === 'string') {
					searchPaths.add(real(result));
				} else if (result && typeof result === 'object') {
					for (const dir of arrayify(result.paths, true)) {
						searchPaths.add(real(dir));
					}
					if (result.defaultPath && typeof result.defaultPath === 'string') {
						defaultPath = result.defaultPath;
					}
				}
			} catch (e) {
				warn('Registry callback threw error: %s', e.message);
			}
		}

		return {
			defaultPath,
			searchPaths
		};
	}

	/**
	 * Calls upon the detectors to scan for items.
	 *
	 * @param {Object} params - Various parameters.
	 * @param {String?} params.defaultPath - The default path used to flag a result as the default.
	 * @param {Array.<String>} params.searchPaths - A list of paths to scan for items.
	 * @returns {Promise<Array|Object>}
	 * @access private
	 */
	async scan({ defaultPath, searchPaths }) {
		log('scan()');
		log('  Entering scan tailgate');

		await tailgate('appcd-detect/engine/${this.id}', async () => {
			log('  id:',           highlight(this.id));
			log('  multiple:',     highlight(!!this.opts.multiple));
			log('  recursive:',    highlight(!!this.opts.recursive));
			log('  redetect:',     highlight(!!this.opts.redetect));
			log('  watch:',        highlight(!!this.opts.watch));
			log('  default path:', highlight(defaultPath || 'n/a'));

			this.defaultPath = defaultPath;

			const previousDetectors = this.detectors;
			this.detectors = new Map();

			for (const dir of searchPaths) {
				if (previousDetectors.has(dir)) {
					log('  Preserving detector: %s', highlight(dir));
					this.detectors.set(dir, previousDetectors.get(dir));
					previousDetectors.delete(dir);
				} else {
					log('  Adding new detector: %s', highlight(dir));
					const detector = new Detector(dir, this);
					detector.on('rescan', debounce(() => {
						log(`  Detector ${highlight(dir)} requested a rescan`);
						this.getPaths().then(paths => this.scan(paths));
					}));
					this.detectors.set(dir, detector);
				}
			}

			// stop the stale detectors
			for (const [ dir, detector ] of previousDetectors) {
				log('  Stopping stale detector: %s', highlight(dir));
				await detector.stop();
			}
			previousDetectors.clear();

			let results = [];

			log('  Starting scan...');
			for (const detector of this.detectors.values()) {
				const result = await detector.scan();
				if (result) {
					results = results.concat(result);
					if (!this.opts.multiple) {
						break;
					}
				}
			}
			log(pluralize(`  Scanning complete, found ${highlight(results.length)} item`, results.length));

			await this.processResults(results);
		});

		log('  Exiting scan tailgate');
	}

	/**
	 * Schedules the paths to refreshed. When the timer fires, it checks if a rescan is needed.
	 *
	 * @access private
	 */
	refreshPaths() {
		this.refreshPathsTimer = setTimeout(async () => {
			try {
				const { defaultPath, searchPaths } = await this.getPaths();

				if (searchPaths.size !== this.detectors.size || [ ...searchPaths ].some(dir => !this.detector.has(dir))) {
					await this.scan({ defaultPath, searchPaths });
				} else if (defaultPath !== this.defaultPath) {
					this.defaultPath = defaultPath;
					await this.processResults(this.results);
				}
			} catch (err) {
				this.emit('error', err);
			}

			this.refreshPaths();
		}, this.opts.refreshPathsInterval);
	}

	/**
	 * Processes the results and then saves them.
	 *
	 * @param {Array.<Object>} results - The results from the scan.
	 * @returns {Promise}
	 * @access private
	 */
	async processResults(results) {
		if (this.opts.processResults) {
			log('  Processing results...');
			results = (await this.opts.processResults(results, this)) || results;
		}
		gawk.set(this.results, arrayify(results, true));
	}
}
