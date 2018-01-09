import appcdLogger from 'appcd-logger';
import Dispatcher from 'appcd-dispatcher';
import fs from 'fs';
import path from 'path';

import { EventEmitter } from 'events';
import { isDir } from 'appcd-fs';
import { real } from 'appcd-path';

const { highlight } = appcdLogger.styles;
const { pluralize } = appcdLogger;

/**
 * A detector watches a specific path. If the path exists, it will scan the path for items of
 * interest. If the path does not exist, it waits for it to exist.
 */
export default class Detector extends EventEmitter {
	sid = null;

	/**
	 * A list of active fs watcher subscription ids by path.
	 * @type {Map}
	 */
	sids = new Map();

	/**
	 * Initializes the detector instance.
	 *
	 * @param {String} dir - The directory to scan.
	 * @param {DetectEngine} engine - A reference the detect engine that owns this `Detector`
	 * instance.
	 * @access public
	 */
	constructor(dir, engine) {
		super();
		this.dir = dir;
		this.engine = engine;
		this.logger = appcdLogger(`appcd:detect:detector:${engine.id}`);
	}

	/**
	 * Scans the directory for items of interest.
	 *
	 * @param {Object} results - An object containing the results found so far.
	 * @returns {Promise}
	 * @access public
	 */
	async scan(results) {
		this.logger.log(`Scanning ${highlight(this.dir)}`);

		const { opts } = this.engine;
		const foundPaths = new Set();

		const checkDir = async (dir, depth) => {
			if (!isDir(dir)) {
				return;
			}

			this.logger.log(`  checkDir(${highlight(`'${dir}'`)}) depth=${highlight(depth)}`);

			if (results[dir]) {
				this.logger.log('      Already found a result for this path');
				return;
			}

			const result = await opts.checkDir(dir);
			if (result) {
				this.logger.log('     Found result');
				if (Array.isArray(result)) {
					results[dir] = result;
				} else {
					results[result.path || dir] = [ result ];
				}
				foundPaths.add(results.path || dir);
				return;
			}

			if (depth <= 0) {
				this.logger.log('    No result, hit max depth, returning');
				return;
			}

			// dir is not what we're looking for, check subdirectories
			this.logger.log('    Walking subdirectories');
			for (const name of fs.readdirSync(dir)) {
				const subdir = real(path.join(dir, name));
				await checkDir(subdir, depth - 1);
				if (Object.keys(results).length && !opts.multiple) {
					return;
				}
			}
		};

		await checkDir(this.dir, opts.depth);

		if (opts.watch) {
			if (!this.sid) {
				this.sid = await this.watch({
					dir: this.dir,
					onFSEvent: async ({ action, file, filename }) => {
						if (filename === '.DS_Store') {
							return;
						}

						if (file === this.dir) {
							if (action === 'delete') {
								this.logger.log('Directory was deleted, stopping and requesting rescan...');
								await this.stop();
								this.emit('rescan');
							} else if (action === 'add') {
								this.logger.log('Directory was added, requesting rescan...');
								this.emit('rescan');
							}
						} else {
							// something changed in this directory
							this.emit('rescan');
						}
					}
				});
			}

			if (foundPaths.size && opts.redetect) {
				this.logger.log(pluralize(`Watching ${highlight(foundPaths.size)} subdirectory`, foundPaths.size));
				this.logger.log(Array.from(foundPaths));
				await Promise.all([ ...foundPaths ].map(subdir => {
					if (this.sids.has(subdir)) {
						return null;
					}

					// this is NOT a bug... we intentially mark the dir as being active, but because
					// wiring up the fs watcher is async, we need to make sure we don't subscribe more
					// than once
					this.sids.set(subdir, false);

					return this
						.watch({
							depth: opts.recursiveWatchDepth,
							dir: subdir,
							onFSEvent: async ({ action, file, filename }, sid) => {
								if (filename === '.DS_Store') {
									return;
								}

								if (file === this.dir && action === 'delete') {
									this.logger.log(`Parent directory ${highlight(file)} was deleted, letting primary fs watcher respond`);
									return;
								}

								if (file === subdir && action === 'delete') {
									this.logger.log(`${highlight(file)} was deleted, unwatching and triggering rescan`);
									await this.unwatch(sid);
									this.sids.delete(subdir);
								} else {
									this.logger.log(`${highlight(file)} was ${action === 'add' ? 'added' : 'changed'}, triggering rescan`);
								}

								this.emit('rescan');
							},
							recursive: opts.recursive
						})
						.then(sid => this.sids.set(subdir, sid));
				}));
			}
		}

		return results;
	}

	/**
	 * Unsubscribes all filesystem watchers.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async stop() {
		if (this.sids.size) {
			for (const sid of this.sids.values()) {
				await this.unwatch(sid);
			}
			this.sids.clear();
		}

		if (this.sid) {
			this.logger.log(`Stopping primary fs watcher: ${highlight(this.dir)}`);
			await this.unwatch(this.sid);
			this.sid = null;
		}
	}

	/**
	 * Starts watching a directory.
	 *
	 * @param {Object} params - Various parameters.
	 * @param {Number} [params.depth] - The depth to recursively watch. Requires `recursive` to be
	 * `true`.
	 * @param {String} params.dir - The path to watch.
	 * @param {Function} params.onFSEvent - A function to call when a fs event occurs.
	 * @param {Boolean} [params.recursive] - When `true`, watches the path recursively.
	 * @returns {Promise<String>} Resolves the subscription id.
	 * @access private
	 */
	watch({ depth, dir, onFSEvent, recursive }) {
		this.logger.log(`  Sending fs watch request: ${highlight(dir)}`);
		return Dispatcher
			.call('/appcd/fswatch', {
				data: {
					depth,
					path: dir,
					recursive
				},
				type: 'subscribe'
			})
			.then(({ response }) => new Promise(resolve => {
				response
					.on('data', ({ message, sid, type }) => {
						if (type === 'subscribe') {
							resolve(sid);
						} else if (type === 'event') {
							onFSEvent(message, sid);
						}
					});
			}));
	}

	/**
	 * Stops watching a directory.
	 *
	 * @param {String} sid - The fs watch subscription id.
	 * @returns {Promise}
	 * @access private
	 */
	unwatch(sid) {
		return sid && Dispatcher
			.call('/appcd/fswatch', {
				sid,
				type: 'unsubscribe'
			})
			.catch(err => {
				this.logger.warn('Failed to unsubscribe:');
				this.logger.warn(err);
			});
	}
}
