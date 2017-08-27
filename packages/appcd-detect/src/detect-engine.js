/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import appcdLogger from 'appcd-logger';
import Dispatcher from 'appcd-dispatcher';
import fs from 'fs';
import gawk, { isGawked } from 'gawk';
import Handle from './handle';
import path from 'path';

import { arrayify, mutex, randomBytes, sha1, unique } from 'appcd-util';
import { isDir } from 'appcd-fs';
import { real } from 'appcd-path';
import { which } from 'appcd-subprocess';

// import { registry } from './windows';

const { log, warn } = appcdLogger('appcd:detect');
const { highlight } = appcdLogger.styles;
const { pluralize } = appcdLogger;

/**
 * A engine for detecting various things. It walks the search paths and calls a `checkDir()`
 * function. The results are accumulated and cached. The engine also supports watching the search
 * paths for changes.
 */
export default class DetectEngine {
	/**
	 * Creates the detect engine instance.
	 *
	 * @param {Object} [opts] - Various detect options.
	 * @param {Function} [opts.checkDir] - A function that is called for each directory when
	 * scanning to check if the specified directory is of interest.
	 * @param {Number} [opts.depth=0] - The max depth to scan each search path.
	 * @param {String|Array<String>} [opts.env] - One or more environment variables containing a
	 * path.
	 * @param {String} [opts.exe] - The name of the executable to search the system path for. If
	 * found, the directory is returned and the value will be marked as the primary path.
	 * @param {Boolean} [opts.multiple=false] - When true, the scanner will continue to scan paths
	 * even after a result has been found.
	 * @param {Function} [opts.processResults] - A function that is called after the scanning is
	 * complete and the results may be modified.
	 * @param {Object|Array<Object>|Function} [opts.registryKeys] - One or more objects containing
	 * the registry `root`, `key`, and value `name` to query the Windows Registry. If value is a
	 * function, it will invoke it and expect the return value to be a path (string), array of paths
	 * (strings), or a promise that resolves a path or array of paths. This function will only be
	 * invoked on the Windows platform.
	 * @param {Number} [opts.registryPollInterval=30000] - The number of milliseconds to check for
	 * updates in the Windows Registry. Only used when `detect()` is called with `watch=true`.
	 * @param {String|Array<String>} [opts.paths] - One or more global search paths to apply to all
	 * `detect()` calls.
	 * @access public
	 */
	constructor(opts = {}) {
		if (opts.checkDir !== undefined && typeof opts.checkDir !== 'function') {
			throw new TypeError('Expected checkDir to be a function');
		}

		if (opts.exe !== undefined && (typeof opts.exe !== 'string' || !opts.exe)) {
			throw new TypeError('Expected exe to be a non-empty string');
		}

		if (opts.processResults !== undefined && typeof opts.processResults !== 'function') {
			throw new TypeError('Expected processResults() to be a function');
		}

		if (opts.registryKeys === null || (opts.registryKeys !== undefined && typeof opts.registryKeys !== 'function' && typeof opts.registryKeys !== 'object')) {
			throw new TypeError('Expected registryKeys to be an object, array of objects, or a function');
		} else if (Array.isArray(opts.registryKeys) && opts.registryKeys.some(r => !r || typeof r !== 'object' || Array.isArray(r) || !r.key || !r.name)) {
			throw new TypeError('Expected registryKeys to be an array of objects with a "key" and "name"');
		} else if (typeof opts.registryKeys === 'object' && (!opts.registryKeys.key || !opts.registryKeys.name)) {
			throw new TypeError('Expected registryKeys to be an object with a "key" and "name"');
		}

		this.options = {
			checkDir:             typeof opts.checkDir === 'function' ? opts.checkDir : null,
			depth:                Math.max(~~opts.depth, 0),
			env:                  arrayify(opts.env, true),
			exe:                  typeof opts.exe === 'string' && opts.exe || null,
			multiple:             !!opts.multiple,
			processResults:       typeof opts.processResults === 'function' ? opts.processResults : null,
			registryKeys:         (opts.registryKeys && typeof opts.registryKeys === 'object' ? arrayify(opts.registryKeys, true) : []),
			registryKeysFn:       typeof opts.registryKeys === 'function' ? opts.registryKeys : null,
			registryPollInterval: Math.max(~~opts.registryPollInterval || 30000, 0),
			paths:                arrayify(opts.paths, true)
		};

		if (this.options.env.some(s => !s || typeof s !== 'string')) {
			throw new TypeError('Expected env to be a string or an array of strings');
		}

		if (this.options.paths.some(s => !s || typeof s !== 'string')) {
			throw new TypeError('Expected paths to be a string or an array of strings');
		}

		this.initialized = false;
		this.defaultPath = null;
		this.cache = {};
		this.rescanTimer = null;
	}

	/**
	 * Main entry for the detection process flow.
	 *
	 * @param {Object} [opts] - An object with various params.
	 * @param {Boolean} [opts.force=false] - When true, bypasses cache and rescans the search paths.
	 * @param {Array} [opts.paths] - One or more paths to search in addition.
	 * @param {Boolean} [opts.recursive=false] - When `true`, recursively watches a path for
	 * changes to trigger a redetect.
	 * @param {Boolean} [opts.redetect=false] - When true, re-runs detection when a path changes.
	 * Requires `watch` to be `true`.
	 * @param {Boolean} [opts.watch=false] - When true, watches for changes and emits the new
	 * results when a change occurs.
	 * @returns {Handle}
	 * @access public
	 */
	detect(opts = {}) {
		const handle = new Handle();
		log('detect()');

		if (opts.redetect && !opts.watch) {
			log('  Disabling redetect since watch was not enabled');
			opts.redetect = false;
		}

		// ensure async
		setImmediate(() => {
			if (opts.paths && (typeof opts.paths !== 'string' && (!Array.isArray(opts.paths) || opts.paths.some(s => typeof s !== 'string')))) {
				handle.emit('error', new TypeError('Expected paths to be a string or an array of strings'));
				return;
			}

			Promise.resolve()
				// initialize
				.then(() => this.initialize())

				// build the list of paths to scan
				.then(() => this.getPaths(opts.paths))

				// scan all paths for whatever we're looking for
				.then(paths => this.startScan({ paths, handle, opts }))
				.catch(err => {
					log(err);
					log('  Stopping watchers, emitting error');
					handle.stop();
					handle.emit('error', err);
				});

			if (opts.watch) {
				handle.unwatchers.set('__rescan_timer__', () => {
					clearTimeout(this.rescanTimer);
					this.rescanTimer = null;
				});
			}
		});

		return handle;
	}

	/**
	 * Initializes the engine by cooking the global search paths which are essentially static.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	initialize() {
		if (this.initialized) {
			return Promise.resolve();
		}

		log('  initialize()');

		let defaultPaths = [];

		return mutex('appcd-detect/engine/initialize', () => {
			return Promise
				.all([
					// search paths
					Promise.all(
						this.options.paths.map(pathOrFn => {
							if (typeof pathOrFn === 'function') {
								return Promise.resolve()
									.then(() => pathOrFn())
									.then(paths => Promise.all(arrayify(paths, true).map(resolveDir)));
							}
							return resolveDir(pathOrFn);
						})
					),

					// environment paths
					Promise.all(
						this.options.env.map(name => {
							return resolveDir(process.env[name])
								.then(path => {
									if (path && typeof path === 'object' && !Array.isArray(path)) {
										path.defaultPath && defaultPaths.push(path.defaultPath);
										return path.paths || null;
									}
									return path;
								});
						})
					),

					// executable path
					this.options.exe && which(this.options.exe)
						.then(file => {
							file = path.dirname(real(file));
							defaultPaths.unshift(file);
							return file;
						})
						.catch(() => Promise.resolve())
				])
				.then(([ paths, envPaths, exePath ]) => {
					this.paths = unique(Array.prototype.concat.apply([], paths));
					this.envPaths = unique(Array.prototype.concat.apply([], envPaths));
					this.exePath = exePath;

					this.defaultPath = defaultPaths[0];

					log('    Found search paths: ', highlight(JSON.stringify(this.paths)));
					log('    Found env paths:', highlight(JSON.stringify(this.envPaths)));
					log('    Found exe paths:', highlight(this.exePath));

					this.initialized = true;
				});
		});
	}

	/**
	 * Combines the global search paths with the passed in search paths and paths from the Windows
	 * registry.
	 *
	 * @param {Array<String>} [userPaths] - The paths to scan.
	 * @returns {Promise}
	 * @access private
	 */
	getPaths(userPaths) {
		return this.initialize()
			.then(() => Promise.all([
				// global search paths
				process.env.NODE_APPC_SKIP_GLOBAL_SEARCH_PATHS ? null : this.paths,

				// windows registry paths
				process.env.NODE_APPC_SKIP_GLOBAL_SEARCH_PATHS ? null : this.queryRegistry(),

				// global environment paths
				process.env.NODE_APPC_SKIP_GLOBAL_ENVIRONMENT_PATHS ? null : this.envPaths,

				// global executable path
				process.env.NODE_APPC_SKIP_GLOBAL_EXECUTABLE_PATH ? null : this.exePath,

				// user paths
				...arrayify(userPaths, true).map(path => {
					if (typeof path === 'function') {
						return Promise.resolve()
							.then(() => path())
							.then(paths => arrayify(paths, true).map(real));
					}
					return real(path);
				})
			]))
			.then(paths => unique(Array.prototype.concat.apply([], paths)));
	}

	/**
	 * Main logic for scanning and watching for changes.
	 *
	 * @param {Array<String>} paths - The paths to scan.
	 * @param {Handle} handle - The handle to emit events from.
	 * @param {Object} opts - Various scan options.
	 * @returns {Promise}
	 * @access private
	 */
	async startScan({ paths, handle, opts }) {
		const sha = handle.lastSha = sha1(paths.sort());
		const id = opts.watch ? randomBytes(10) : sha;

		log('  startScan()');
		log('    paths:',     highlight(JSON.stringify(paths)));
		log('    id:',        highlight(id));
		log('    force:',     highlight(!!opts.force));
		log('    recursive:', highlight(!!opts.recursive));
		log('    watch:',     highlight(!!opts.watch));

		const handleError = err => {
			log(err);
			log('  Stopping watchers, emitting error');
			handle.stop();
			handle.emit('error', err);
			throw err;
		};

		let firstTime = true;
		let activeScan = null;

		log('  Default path:', highlight(this.defaultPath));
		this.lastDefaultPath = this.defaultPath;

		const watchPaths = (prefix, paths) => new Promise(resolve => {
			const active = {};

			if (paths.length) {
				log(`  Watching paths ${opts.recursive ? '' : 'non-'}recursivly:`);
				for (const dir of paths) {
					log(`    ${highlight(dir)}`);
				}

				// start watching the paths
				for (const dir of paths) {
					const key = `${prefix}:${dir}`;
					active[key] = 1;
					if (!handle.unwatchers.has(key)) {
						handle.unwatchers.set(key, false);

						Dispatcher
							.call('/appcd/fswatch', {
								data: {
									path: dir,
									recursive: opts.recursive
								},
								type: 'subscribe'
							})
							.then(ctx => {
								ctx.response
									.on('data', data => {
										switch (data.type) {
											case 'subscribe':
												const { sid, topic } = data;

												handle.unwatchers.delete(key);
												handle.unwatchers.set(key, () => {
													return Dispatcher
														.call('/appcd/fswatch', {
															data: {
																path: topic
															},
															sid,
															type: 'unsubscribe'
														})
														.catch(err => {
															warn('Failed to unsubscribe from topic: %s', topic);
															warn(err);
														});
												});

												resolve();
												break;

											case 'event':
												log('    fs event, rescanning', dir);
												this.scan({ id, handle, paths, force: true, onlyPaths: [ dir ] })
													.then(() => {
														log('      Scan complete');
														// no need to emit... the gawk watcher will do it
													})
													.catch(handleError);
										}
									})
									.on('end', () => {
										handle.unwatchers.delete(key);
									});
							})
							.catch(handleError);
					}
				}
			} else {
				log('  No paths to watch');
			}

			// remove any inactive watchers
			for (const key of handle.unwatchers.keys()) {
				if (key.indexOf(prefix + ':') === 0 && !active[key]) {
					const unwatch = handle.unwatchers.get(key);
					if (typeof unwatch === 'function') {
						unwatch();
					}
					handle.unwatchers.delete(key);
				}
			}
		});

		if (opts.watch) {
			await watchPaths('watch', paths);
		}

		// windows only... checks the registry to see if paths have changed
		// which will trigger a rescan
		const checkRegistry = () => {
			this.rescanTimer = setTimeout(() => {
				this.getPaths(opts.paths)
					.then(paths => {
						log('    Starting scan to see if paths changed');
						log('    paths:', paths);
						const sha = sha1(paths.sort());
						if (handle.lastSha !== sha) {
							log('  Paths changed, rescanning', handle.lastSha, sha);
							handle.lastSha = sha;
							return runScan(paths);
						} else if (this.lastDefaultPath !== this.defaultPath) {
							log('  Default path changed, rescanning');
							log('    ' + this.lastDefaultPath);
							log('    ' + this.defaultPath);
							this.lastDefaultPath = this.defaultPath;
							return this.processResults(this.cache[id].results, id);
						}
					})
					.then(checkRegistry)
					.catch(handleError);
			}, this.options.registryPollInterval);
		};

		const runScan = paths => {
			if (!activeScan) {
				activeScan = Promise.resolve();
			}

			return activeScan
				.then(() => this.scan({ id, handle, paths, force: opts.force }))
				.then(async ({ container, pathsFound }) => {
					const results = container.results;
					log('  Scan complete', results);

					// wire up watch on the gawked results
					if (opts.watch && firstTime) {
						log('  Watching gawk object');
						gawk.watch(container, () => {
							log('  Gawk object changed, emitting:', container.results);
							handle.emit('results', container.results);
						});

						if (process.platform === 'win32') {
							log('  Watching registry for path changes');
							checkRegistry();
						}
					}

					// if we're watching and redetect is enabled, then watch the found paths for
					// changes
					if (opts.watch && opts.redetect && pathsFound.length) {
						// first wire up the recursive watches so that we don't incur more overhead
						// to unwatching nodes and re-watching them
						await watchPaths('redetect', pathsFound);

						// next remove the non-recursive watch paths since we just replaced them
						// with recursive watches
						log('  Removing non-recursive watch paths:');
						for (const dir of pathsFound) {
							const watchKey = `watch:${dir}`;
							if (handle.unwatchers.has(watchKey)) {
								const unwatch = handle.unwatchers.get(watchKey);
								log(`    ${highlight(dir)}`);
								if (typeof unwatch === 'function') {
									await unwatch();
								}
								handle.unwatchers.delete(watchKey);
							}
						}
					}

					if (firstTime) {
						if (!opts.watch || results) {
							// emit the results
							log('  Emitting results:', results);
							handle.emit('results', results);
						}

						// if we're watching, we only emitted results above if there were results,
						// but it's handy to emit an event that lets consumers know that when the
						// first scan has finished
						if (opts.watch) {
							handle.emit('ready', results);
							firstTime = false;
						}
					}

					activeScan = null;
				});
		};

		log('  Performing initial scan');
		return runScan(paths).catch(handleError);
	}

	/**
	 * Scans the paths and invokes the specified `checkDir()` function.
	 *
	 * @param {Handle} id - The unique identifier used to cache the results.
	 * @param {Array<String>} paths - The paths to scan.
	 * @param {Boolean} [opts.force=false] - When true, bypasses cache and rescans the search paths.
	 * @param {Array<String>} [onlyPaths] - When present, it will only scan these paths and mix the
	 * results with all paths which are pulled from cache.
	 * @returns {Promise}
	 * @access private
	 */
	scan({ id, paths, force, onlyPaths }) {
		const results = [];
		const pathsFound = [];
		let index = 0;

		log('  scan()', highlight(JSON.stringify(paths)));

		const next = () => {
			const dir = paths[index++];
			if (!this.options.checkDir || !dir) {
				log('    Finished scanning paths');
				return;
			}

			log('    Scanning ' + highlight(index + '/' + paths.length) + ': ' + highlight(dir));

			// check cache first
			if (this.cache.hasOwnProperty(dir) && (!force || (onlyPaths && onlyPaths.indexOf(dir) === -1))) {
				log('    Result for this directory cached, pushing to results');
				if (this.cache[dir]) {
					results.push.apply(results, arrayify(this.cache[dir]));
				}
				return this.options.multiple ? next() : null;
			}

			// not cached, set up our directory walking chain
			const check = (dir, depth) => {
				if (!isDir(dir)) {
					return Promise.resolve();
				}

				log(`      checkDir(${highlight(`'${dir}'`)}) depth=${depth}`);

				return Promise.resolve()
					.then(() => this.options.checkDir(dir))
					.then(result => {
						if (result) {
							log('      Got result, returning:', result);
							pathsFound.push(dir);
							return result;
						}
						if (depth <= 0) {
							log('      No result, hit max depth, returning');
							return;
						}

						// dir is not what we're looking for, check subdirectories
						const subdirs = [];
						for (const name of fs.readdirSync(dir)) {
							const subdir = path.join(dir, name);
							isDir(subdir) && subdirs.push(subdir);
						}

						if (!subdirs.length) {
							return;
						}

						log('      Walking subdirs:', highlight(JSON.stringify(subdirs)));

						return Promise.resolve()
							.then(function nextSubDir() {
								const subdir = subdirs.shift();
								if (subdir) {
									return Promise.resolve()
										.then(() => check(subdir, depth - 1))
										.then(result => result || nextSubDir());
								}
							});
					});
			};

			return check(dir, this.options.depth)
				.then(result => {
					log('      Done checking ' + highlight(dir));

					// even if we don't have a result, we still cache that there was no result
					log('      Caching result');
					this.cache[dir] = result || null;

					if (result) {
						results.push.apply(results, Array.isArray(result) ? result : [ result ]);
					}

					if (!result || this.options.multiple) {
						log('  Checking next directory');
						return next();
					}
				});
		};

		log('    Entering mutex');
		return mutex('node-appc/detect/engine/' + id + (force ? '/' + randomBytes(5) : ''), () => {
			log('    Walking directories:', highlight(JSON.stringify(paths)));
			return Promise.resolve()
				.then(next)
				.then(() => {
					log(`  Scanning found ${highlight(results.length)} ${pluralize('result', results.length)}`);
					return this.processResults(results, id);
				});
		}).then(container => {
			log('    Exiting mutex');
			return { container, pathsFound };
		});
	}

	/**
	 * Caches the results using the specified id.
	 *
	 * @param {Array|*} results - The results to cache. This is an array by default, but a custom
	 * `processResults()` handler could modify it.
	 * @param {String} id - The identifier of the results in the cache.
	 * @returns {Promise} Resolves a gawked object with a key "results".
	 * @access private
	 */
	processResults(results, id) {
		log(`  processResults() ${highlight(results.length)} ${pluralize('result', results.length)}`);

		let container = this.cache[id];
		if (!container) {
			log('    Creating cached gawk object container');
			container = this.cache[id] = gawk({ results: undefined });
		}

		const existingValue = container.results;

		return Promise.resolve()
			.then(() => {
				if (this.options.multiple) {
					log('    Ensuring results is an array of results');
					results = Array.isArray(results) ? results : (results ? [ results ] : []);
					log('    ', results);
				} else {
					log('    Ensuring results is a single result');
					results = Array.isArray(results) ? results[0] : (results || null);
					log('    ', results);
				}

				// call processResults() to allow implementations to sort and assign a default
				if (!this.options.processResults) {
					return results;
				}

				return Promise.resolve()
					.then(() => this.options.processResults(results, existingValue, this))
					.then(newResults => newResults || results);
			})
			.then(results => {
				// ensure that the value is a gawked data type
				log('    Gawking results');
				results = gawk(results);

				if (this.options.multiple) {
					// results will be a gawked array
					if (isGawked(existingValue) && Array.isArray(existingValue)) {
						if (Array.isArray(results)) {
							log('    Overriding gawk array value');
							existingValue.splice(0, existingValue.length, ...results);
							log('    Done');
						} else {
							log('    Pushing results into results array');
							existingValue.push(results);
						}
					} else {
						log('    No existing value, setting');
						container.results = gawk(results);
					}

				// single result
				} else if (isGawked(existingValue)) {
					log('    Merging results into existing value:', results);
					gawk.mergeDeep(existingValue, results);
				} else {
					log('    Setting new value:', results);
					container.results = results;
				}

				return container;
			});
	}

	/**
	 * Queries the Windows Registyr for the given registry keys or function. If the paths change,
	 * the results will be re-detected.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	queryRegistry() {
		if (process.platform !== 'win32') {
			return;
		}

		return Promise
			.all([
				// ...this.options.registryKeys.map(reg => {
				// TODO:
				// 	return registry
				// 		.get(reg.root || 'HKLM', reg.key, reg.name)
				// 		.catch(err => Promise.resolve());
				// }),

				!this.options.registryKeysFn ? null : Promise.resolve()
					.then(() => this.options.registryKeysFn())
			])
			.then(paths => {
				return Array.prototype.concat.apply([], paths.map(p => {
					if (p && typeof p === 'object') {
						this.defaultPath = p.defaultPath;
						return p.paths;
					}
					return p;
				}));
			});
	}
}

/**
 * Resolves a specific directory.
 *
 * @param {String} dir - The directory to resolve.
 * @returns {Promise} Resolves the directory.
 */
function resolveDir(dir) {
	return new Promise(resolve => {
		fs.stat(dir, (err, stat) => {
			if (err) {
				return resolve(err.code === 'ENOENT' ? dir : null);
			}

			if (!stat.isDirectory()) {
				return resolve();
			}

			resolve(real(dir));
		});
	});
}
