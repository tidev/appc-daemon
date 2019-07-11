import appcdLogger from 'appcd-logger';
import Detector from './detector';
import gawk from 'gawk';
import path from 'path';
import pluralize from 'pluralize';
import RegistryWatcher from './registry-watcher';

import { arrayify, debounce, randomBytes, tailgate } from 'appcd-util';
import { EventEmitter } from 'events';
import { real } from 'appcd-path';
import { which } from 'appcd-subprocess';

const { highlight } = appcdLogger.styles;

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
	 * A list of active Windows Registry watch handles.
	 * @type {Array.<WatchHandle>}
	 */
	registryWatchHandles = [];

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
	 * A reference to the `winreglib` module. Only available on Windows machines.
	 * @type {Object}
	 */
	winreglib = process.platform === 'win32' ? require('winreglib') : null;

	/**
	 * Initializes the detect engine instance and validates the options.
	 *
	 * @param {Object} [opts] - Various detect options.
	 * @param {Function} [opts.checkDir] - A function that is called for each directory when
	 * scanning to check if the specified directory is of interest.
	 * @param {String|Array<String>|Set} [opts.env] - One or more environment variables containing a
	 * path.
	 * @param {Number} [opts.depth=0] - The max depth to scan each search path. Must be greater than
	 * or equal to zero. If the `depth` is `0`, it will not scan subdirectories of each path.
	 * @param {String} [opts.envPath] - A string of paths to use instead of the `PATH` environment
	 * variable.
	 * @param {String|Array<String>|Set} [opts.exe] - The name of the executable to search the
	 * system path for. If found, the directory is returned and the value will be marked as the
	 * primary path. Each exe may be prefixed by one or more `../` paths which will be stripped off
	 * prior to searching for the executable, but then applied to the result.
	 * @param {Boolean} [opts.multiple=false] - When true, the scanner will continue to scan paths
	 * even after a result has been found.
	 * @param {String} [opts.name] - A name to prepend to the detect engine instance for logging.
	 * @param {String|Array<String>|Set} [opts.paths] - One or more paths to scan.
	 * @param {Function} [opts.processResults] - A function that is called after the scanning is
	 * complete and the results may be modified.
	 * @param {Boolean} [opts.recursive=false] - When `true`, recursively watches a path for
	 * changes to trigger a redetect.
	 * @param {Number} [opts.recursiveWatchDepth=Infinity] - The max depth to recursively watch a
	 * found path. Requires `opts.recursive` to be `true`.
	 * @param {Boolean} [opts.redetect=false] - When `true`, re-runs detection when a path changes.
	 * Requires `watch` to be `true`.
	 * @param {Number} [opts.refreshPathsInterval=30000] - The number of milliseconds to wait
	 * between calls to `opts.registryCallback`. This option is ignored on non-Windows platforms.
	 * @param {Function} [opts.registryCallback] - A function that will only be invoked when the
	 * current platform is `win32` and `opts.watch` is set to `true`. The intent is this function
	 * performs whatever Windows Registry queries, then returns a promise that resolves an object
	 * containing two properties: `paths` containing an array of paths to add to the list of search
	 * paths and `defaultPath` containing either undefined or a string with a path. This option is
	 * ignored on non-Windows platforms.
	 * @param {Array<Object>|Set|Object} [opts.registryKeys] - An array containg one or more
	 * registry watch parameter objects. There are two types of params: `paths` and `rescan`. This
	 * option is ignored on non-Windows platforms.
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

		opts.exe = arrayify(opts.exe, true);
		if (opts.exe.some(s => !s || typeof s !== 'string')) {
			throw new TypeError('Expected "exe" option to be a non-empty string or an array or set of non-empty strings');
		}

		opts.paths = arrayify(opts.paths, true);
		if (opts.paths.some(s => !s || typeof s !== 'string')) {
			throw new TypeError('Expected "paths" option to be a non-empty string or an array or set of non-empty strings');
		}

		if (opts.processResults !== undefined && typeof opts.processResults !== 'function') {
			throw new TypeError('Expected "processResults" option to be a function');
		}

		if (opts.recursiveWatchDepth !== undefined) {
			opts.recursiveWatchDepth = Math.max(~~opts.recursiveWatchDepth, 0);
		}

		// we only set redetect if we're watching
		opts.redetect = opts.watch ? opts.redetect : false;

		super();

		if (this.winreglib) {
			opts.refreshPathsInterval = Math.max(~~opts.refreshPathsInterval || 30000, 0);

			if (opts.registryCallback !== undefined && typeof opts.registryCallback !== 'function') {
				throw new TypeError('Expected "registryCallback" option to be a function');
			}

			const registryKeys = arrayify(opts.registryKeys, true);
			opts.registryKeys = [];

			// validate and normalize registry keys
			for (const params of registryKeys) {
				if (typeof params !== 'object' || Array.isArray(params)) {
					throw new TypeError('Expected "registryKeys" option to be an object or array of registry watch parameters');
				}

				const type = params.type || 'paths';
				if (type !== 'paths' && type !== 'rescan') {
					throw new Error(`Invalid "registryKeys" param type "${type}", expected "paths" or "rescan"`);
				}

				const obj = {
					keys: [],
					type
				};

				const addKey = obj => {
					const p = {
						key: obj.key,
						value: obj.value || obj.name
					};
					if (!p.key || typeof p.key !== 'string') {
						throw new TypeError('Expected "registryKeys" option\'s watch param to have a "key"');
					}
					if (!p.value || typeof p.value !== 'string') {
						throw new TypeError('Expected "registryKeys" option\'s watch param to have a "value" name');
					}
					if (obj.hive !== undefined) {
						if (!obj.hive || typeof obj.hive !== 'string') {
							throw new TypeError('Expected "registryKeys" option\'s watch param "hive" to be a non-empty string');
						}
						p.key = `${obj.hive}\\${p.key}`;
					}
					if (obj.filter) {
						if (type !== 'rescan') {
							throw new Error('Expected "registryKeys" option\'s watch param "filter" to only be set when type is "rescan"')
						}
						if (typeof obj.filter !== 'object' || Array.isArray(obj.filter)) {
							throw new TypeError('Expected "registryKeys" option\'s watch param "filter" to be an object');
						}
						if (obj.filter.values && (typeof obj.filter.values === 'string' || obj.filter.values instanceof RegExp)) {
							p.filter = {
								values
							};
						}
						if (obj.filter.subkeys && (typeof obj.filter.subkeys === 'string' || obj.filter.subkeys instanceof RegExp)) {
							if (!p.filter) {
								p.filter = {};
							}
							p.filter.subkeys = subkeys;
						}
					}
					if (obj.callback !== undefined) {
						if (typeof obj.callback !== 'function') {
							throw new TypeError('Expected "registryKeys" option\'s watch param "callback" to be a function');
						}
						p.callback = obj.callback;
					}
					obj.keys.push(p);
				};

				if (params.key !== undefined && params.keys !== undefined) {
					throw new Error('Expected "registryKeys" option\'s watch param to have either "key" or "keys", not both');
				} else if (params.key !== undefined) {
					addKey(params);
				} else if (params.keys !== undefined) {
					if (!Array.isArray(params.keys)) {
						throw new TypeError('Expected "registryKeys" option\'s watch param "keys" to be an array of objects');
					}

					for (const param of params.keys) {
						if (param) {
							if (typeof param !== 'object') {
								throw new TypeError('Expected "registryKeys" option\'s watch param "keys" to be an array of objects');
							}
							addKey(param);
						}
					}

					if (param.callback !== undefined) {
						if (typeof param.callback !== 'function') {
							throw new TypeError('Expected "registryKeys" option\'s watch param "callback" to be a function');
						}
						obj.callback = param.callback;
					}
				}

				if (obj.keys.length) {
					opts.registryKeys.push(obj);
				}
			}
		}

		this.opts = opts;

		const name = (opts.name || '').trim();
		const id = randomBytes(4);

		/**
		 * A random id that identifies this detect engine instance when creating tailgates.
		 * @type {String}
		 */
		this.id = (name ? `<${name}:${id}>` : `<${id}>`);

		/**
		 * The scoped detect engine log instance.
		 * @type {SnoopLogg}
		 */
		this.logger = appcdLogger(`appcd:detect:${this.id}`);

		// we need to have at least one 'error' handler
		this.on('error', () => {});

		// wire up result changes to be emitted
		gawk.watch(this.results, results => {
			this.emit('results', opts.multiple ? results : results[0]);
		});
	}

	/**
	 * Determines the list of search paths and the default path.
	 *
	 * @returns {Promise<Object>}
	 * @access private
	 */
	async getPaths() {
		const searchPaths = new Set(this.opts.paths.map(dir => real(dir)));

		// we grab the first path as the default
		let defaultPath = searchPaths.values().next().value;
		let prevDefaultPath = defaultPath;
		this.logger.log(`Initial default path: ${highlight(defaultPath)}`);

		// finish the initialization of the original list of paths
		for (const exe of this.opts.exe) {
			try {
				const p = Math.max(exe.lastIndexOf('/'), exe.lastIndexOf('\\'));
				if (p === -1) {
					defaultPath = path.dirname(real(await which(exe, {
						path: this.opts.envPath
					})));
				} else {
					defaultPath = real(path.resolve(await which(exe.substring(p + 1), {
						path: this.opts.envPath
					}), exe.substring(0, p)));
				}
				if (defaultPath !== prevDefaultPath) {
					this.logger.log(`Overwriting default path based on exe: ${highlight(defaultPath)}`);
					searchPaths.add(prevDefaultPath = defaultPath);
				}
			} catch (e) {
				// squelch
			}
		}

		// environment paths
		for (const name of this.opts.env) {
			const dir = process.env[name];
			if (dir) {
				defaultPath = real(dir);
				if (defaultPath !== prevDefaultPath) {
					searchPaths.add(prevDefaultPath = defaultPath);
					this.logger.log(`Overwriting default path based on env: ${highlight(defaultPath)}`);
				}
			}
		}

		if (this.winreglib) {
			await Promise.all(this.opts.registryKeys.map(async obj => {
				try {
					searchPaths.add(real(this.winreglib.get(obj.hive ? `${obj.hive}\\${obj.key}` : obj.key, obj.name)));
				} catch (e) {
					this.logger.warn('Failed to get registry key: %s', e.message);
				}
			}));

			if (typeof this.opts.registryCallback === 'function') {
				try {
					const result = await this.opts.registryCallback();
					if (result && typeof result === 'string') {
						searchPaths.add(real(result));
					} else if (result && typeof result === 'object') {
						for (const dir of arrayify(result.paths, true)) {
							searchPaths.add(real(dir));
						}
						if (result.defaultPath && typeof result.defaultPath === 'string' && defaultPath !== result.defaultPath) {
							defaultPath = result.defaultPath;
							this.logger.log(`Overwriting default path based on registry: ${highlight(defaultPath)}`);
						}
					}
				} catch (e) {
					this.logger.warn('Registry callback threw error: %s', e.message);
				}
			}

			await Promise.all(this.opts.watchRegistryKeys.map(async obj => {
				// obj.key
				// obj.type
				// obj.value
				// obj.filter
				// obj.callback
				// obj.keys
			}));
		}

		return {
			defaultPath,
			searchPaths
		};
	}

	/**
	 * The list of paths to scan.
	 *
	 * @type {Array.<String>}
	 * @access public
	 */
	get paths() {
		return Array.from(this.searchPaths || []);
	}

	set paths(value) {
		const paths = arrayify(value, true);
		if (paths.some(s => !s || typeof s !== 'string')) {
			throw new TypeError('Expected "paths" option to be a non-empty string or an array or set of non-empty strings');
		}
		this.logger.log(`Changing paths from ${highlight(JSON.stringify(this.opts.paths))} to ${highlight(JSON.stringify(value))}`);
		this.opts.paths = paths;
		this.rescan();
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
			this.logger.log('  Processing results...');
			results = (await this.opts.processResults(results, this)) || results;
		}
		gawk.set(this.results, arrayify(results, true));
	}

	/**
	 * Schedules the paths to refreshed. When the timer fires, it checks if a rescan is needed.
	 *
	 * @access private
	 */
	refreshPaths() {
		if (this.opts.registryCallback && this.opts.refreshPathsInterval && this.opts.watch) {
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
	 * Calls upon the detectors to scan for items.
	 *
	 * @param {Object} params - Various parameters.
	 * @param {String?} params.defaultPath - The default path used to flag a result as the default.
	 * @param {Array.<String>} params.searchPaths - A list of paths to scan for items.
	 * @returns {Promise<Array|Object>}
	 * @access private
	 */
	async scan({ defaultPath, searchPaths }) {
		const tailgateId = `appcd-detect/engine/${this.id}`;

		await tailgate(tailgateId, async () => {
			this.logger.log('scan()');
			this.logger.log('  id:',           highlight(this.id));
			this.logger.log('  tailgate:',     highlight(tailgateId));
			this.logger.log('  multiple:',     highlight(!!this.opts.multiple));
			this.logger.log('  recursive:',    highlight(!!this.opts.recursive));
			this.logger.log('  redetect:',     highlight(!!this.opts.redetect));
			this.logger.log('  watch:',        highlight(!!this.opts.watch));
			this.logger.log('  default path:', highlight(defaultPath || 'n/a'));

			this.defaultPath = defaultPath;
			this.searchPaths = searchPaths;

			const previousDetectors = this.detectors;
			this.detectors = new Map();

			for (const dir of searchPaths) {
				if (previousDetectors.has(dir)) {
					this.logger.log(`  Preserving detector: ${highlight(dir)}`);
					this.detectors.set(dir, previousDetectors.get(dir));
					previousDetectors.delete(dir);
				} else {
					this.logger.log(`  Adding new detector: ${highlight(dir)}`);
					const detector = new Detector(dir, this);
					detector.on('rescan', debounce(async () => {
						this.logger.log(`  Detector ${highlight(dir)} requested a rescan`);
						this.scan(await this.getPaths());
					}));
					this.detectors.set(dir, detector);
				}
			}

			// stop the stale detectors
			for (const [ dir, detector ] of previousDetectors) {
				this.logger.log(`  Stopping stale detector: ${highlight(dir)}`);
				await detector.stop();
			}
			previousDetectors.clear();

			const results = {};

			this.logger.log('  Starting scan...');
			for (const detector of this.detectors.values()) {
				await detector.scan(results);
				if (Object.keys(results).length && !this.opts.multiple) {
					break;
				}
			}

			this.logger.log(pluralize(`  Scanning complete, found ${highlight(Object.keys(results).length)} item`, Object.keys(results).length));

			await this.processResults([].concat.apply([], Object.values(results)));

			this.logger.log('  Exiting scan tailgate');
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
			if (this.winreglib && this.opts.watch) {
				for (const params of this.opts.registryKeys) {
					if (params.type === 'rescan') {
						registryWatchHandles.push(new RegistryWatcher(params, this));
					}
				}
			}

			await this.rescan();

			if (this.winreglib) {
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
		this.logger.log('stop()');
		if (this.refreshPathsTimer) {
			this.logger.log('  Cancelling refresh paths timer');
			clearTimeout(this.refreshPathsTimer);
			this.refreshPathsTimer = null;
		}

		let handle;
		while (handle = this.registryWatchHandles.shift()) {
			handle.destroy();
		}

		this.logger.log(pluralize(`  Stopping ${highlight(this.detectors.size)} detector`, this.detectors.size));
		for (const detector of this.detectors.values()) {
			await detector.stop();
		}
		this.detectors.clear();
	}
}
