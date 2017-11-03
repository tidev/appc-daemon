import appcdLogger from 'appcd-logger';
import Dispatcher from 'appcd-dispatcher';
import fs from 'fs';
import path from 'path';

import { EventEmitter } from 'events';
import { isDir } from 'appcd-fs';

const { log, warn } = appcdLogger('appcd:detect:detector');
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
	}

	/**
	 * Scans the directory for items of interest.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async scan() {
		log('Scanning %s', highlight(this.dir));

		const { opts } = this.engine;
		const foundPaths = new Set();
		let results = [];

		const checkDir = async (dir, depth) => {
			if (!isDir(this.dir)) {
				return;
			}

			log(`  checkDir(${highlight(`'${dir}'`)}) depth=${highlight(depth)}`);

			const result = await opts.checkDir(dir);
			if (result) {
				log('      Got result, returning:', result);
				results = results.concat(result);
				foundPaths.add(dir);
				return;
			}

			if (depth <= 0) {
				log('    No result, hit max depth, returning');
				return;
			}

			// dir is not what we're looking for, check subdirectories
			log('    Walking subdirectories');
			for (const name of fs.readdirSync(dir)) {
				const subdir = path.join(dir, name);
				await checkDir(subdir, depth - 1);
				if (results.length && !opts.multiple) {
					return;
				}
			}
		};

		await checkDir(this.dir, opts.depth);

		if (opts.watch) {
			if (!this.sid) {
				this.sid = await this.watch({
					dir: this.dir,
					onFSEvent: async ({ action, file }) => {
						if (file === this.dir) {
							if (action === 'delete') {
								log('Directory was deleted, stopping and requesting rescan...');
								await this.stop();
								this.emit('rescan');
							} else if (action === 'add') {
								log('Directory was added, requesting rescan...');
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
				log(pluralize(`Watching ${highlight(foundPaths.size)} subdirectory`, foundPaths.size));
				log(foundPaths);
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
							depth: opts.depth,
							dir: subdir,
							onFSEvent: async ({ action, file }, sid) => {
								if (file === this.dir && action === 'delete') {
									log(`Parent directory ${highlight(file)} was deleted, letting primary fs watcher respond`);
									return;
								}

								if (file === subdir && action === 'delete') {
									log(`${highlight(file)} was deleted, unwatching and triggering rescan`);
									await this.unwatch(sid);
									this.sids.delete(subdir);
								} else {
									log(`${highlight(file)} was ${action === 'add' ? 'added' : 'changed'}, triggering rescan`);
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
			log(`Stopping primary fs watcher: ${highlight(this.dir)}`);
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
		log(`  Sending fs watch request: ${highlight(dir)}`);
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
				warn('Failed to unsubscribe:');
				warn(err);
			});
	}
}
