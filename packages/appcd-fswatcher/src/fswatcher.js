/* eslint no-confusing-arrow: "off", import/no-mutable-exports: "off" */

import appcdLogger from 'appcd-logger';
import fs from 'fs';
import gawk from 'gawk';
import _path from 'path';

import { debounce } from 'appcd-util';
import { EventEmitter } from 'events';

const { error, log } = appcdLogger('appcd:fswatcher');
const { highlight, green } = appcdLogger.styles;
const { pluralize } = appcdLogger;

/**
 * A regex that matches a path's root.
 * @type {RegExp}
 */
const rootRegExp = /^(\/|[A-Za-z]+:\\)(.+)?$/;

/**
 * A counter used to assign a unique number to each `FSWatcher` instance.
 * @type {Number}
 */
let watcherCounter = 0;

/**
 * An emitter that is used to broadcast all FS events for all nodes.
 * @type {EventEmitter}
 */
export const rootEmitter = new EventEmitter();

/**
 * A map of roots to watched node trees.
 * @type {Object}
 */
export const roots = {};

/**
 * The rendered fs watch tree.
 * @type {String}
 */
export let tree = '<empty tree>';

/**
 * Stat counters.
 * @type {Object}
 */
export const stats = gawk.watch(gawk({
	nodes:      0,
	fswatchers: 0,
	watchers:   0
}), debounce(obj => {
	const stats = JSON.parse(JSON.stringify(obj));
	stats.tree = tree = renderTree();
	rootEmitter.emit('stats', stats);
}));

/**
 * `Node` types.
 * @constant
 * @type {Number}
 * @default
 */
export const DOES_NOT_EXIST = 0;
export const DIRECTORY      = 1;
export const FILE           = 2;
export const SYMLINK        = 4;
export const RESTRICTED     = 8;

/**
 * Tracks the state for a directory, file, symlink, or non-existent file and notifies watchers of
 * file system changes for a given node.
 */
export class Node {
	/**
	 * Constructs the node instance and stats the path.
	 *
	 * @param {String} path - The path to the node.
	 * @param {Node} [parent] - A reference to the parent node. If set, it will check the parent if
	 * being recursively watched and sends fs event notifications to the parent.
	 * @access public
	 */
	constructor(path, parent) {
		/**
		 * A map of filenames to nodes. Child nodes are paths of interest, but may or may not
		 * actually exist.
		 * @type {Object}
		 */
		this.children = {};

		/**
		 * A map of watcher ids to recursive depths relative to this node.
		 * @type {Object}
		 */
		this.depths = {};

		/**
		 * A list of nodes that symbolically link to this node.
		 * @type {Set}
		 */
		this.links = new Set();

		/**
		 * The filename of this node.
		 * @type {String}
		 */
		this.name = _path.basename(path) || path;

		/**
		 * A reference to the parent node.
		 * @type {?Node}
		 */
		this.parent = parent || null;

		/**
		 * The full path to this node.
		 * @type {String}
		 */
		this.path = this.realPath = path;

		/**
		 * A list of `FSWatcher` instances that watch this node.
		 * @type {Set}
		 */
		this.watchers = new Set();

		stats.nodes++;
		// log('Incrementing stats.nodes to %s %s', stats.nodes, highlight(this.path));

		this.stat();
	}

	/**
	 * Creates a node for the specified file and adds it as a child to this node.
	 *
	 * @param {String} filename - The name of the file or directory.
	 * @param {Boolean} [action] - When value is `add', stats the new node and adds it as a child.
	 * @param {Boolean} [dirOnly] - When `true`, only adds the child node if it's a directory.
	 * @returns {?Node} The child node.
	 * @access public
	 */
	addChild(filename, action, dirOnly) {
		// create a node so that we can stat it
		const node = new Node(_path.join(this.path, filename), this);

		if (!dirOnly || node.type & DIRECTORY || node.type & SYMLINK) {
			log('Creating node for %s', highlight(node.path));
			node.init(action);
			this.children[node.name] = node;
			return node;
		}

		// we are not interested in the node, so destroy it
		node.destroy();
		return null;
	}

	/**
	 * Closes this node's native fs watcher.
	 *
	 * @access private
	 */
	closeFSWatcher() {
		if (this.fswatcher) {
			this.fswatcher.close();
			delete this.fswatcher;
			stats.fswatchers--;
			log('Closed fs watcher: %s (%s)', highlight(this.path), stats.fswatchers);
		}
	}

	/**
	 * Destroys the current node by stopping the file system watcher, clearing all files, links, and
	 * watchers. Once this has been called, this node can be removed from the parent node.
	 *
	 * Once `destroy()` is called, it is not advised to attempt to re-initialize it.
	 *
	 * @access public
	 */
	destroy() {
		if (!this.destroyed) {
			this.destroyed = true;

			if (this.link) {
				log('Destroying %s → %s', highlight(this.path), highlight(this.link.path));
			} else {
				log('Destroying %s', highlight(this.path));
			}

			stats.nodes--;
			// log('Decrementing stats.nodes to %s %s', stats.nodes, highlight(this.path));

			this.closeFSWatcher();

			if (this.files) {
				this.files.clear();
			}

			this.parent = null;

			for (const node of this.links) {
				delete node.link;
			}

			this.links.clear();

			stats.watchers -= this.watchers.size;
			this.watchers.clear();

			for (const name of Object.keys(this.children)) {
				this.children[name].destroy();
				delete this.children[name];
			}

			// log(renderTree());
		}
	}

	/**
	 * Adds a node as a child and automatically sets this node as its parent.
	 *
	 * @param {String} name - The child file or directory name to get.
	 * @returns {Node} The child node or `null` if not found.
	 * @access public
	 */
	getChild(name) {
		return this.children[name] || null;
	}

	/**
	 * Initializes the node by starting the actual fs watch and listing of files when the node is a
	 * directory, or registers the real path if this node is a symlink.
	 *
	 * @param {String} action - When `add` and this node is a directory, it will stat and initialize
	 * any existing watched child nodes. If `change`, then it will only notify watched child nodes.
	 * @returns {Node|null} Returns `null` if the node is restricted, otherwise a reference to
	 * itself.
	 * @access private
	 */
	init(action) {
		const isDir      = this.type & DIRECTORY;
		const isFile     = this.type & FILE;
		const isSymlink  = this.type & SYMLINK;

		if (!isDir) {
			this.closeFSWatcher();
		}

		// if we have a symlink, register the real path and add it's real node to this node's links
		if (isSymlink) {
			this.link = register(this.realPath);
			this.link.links.add(this);

		// if we have a directory, then initialize the listing and recurse if necessary
		} else if (isDir) {
			// init the recursion depths
			this.depths = {};
			if (this.parent) {
				for (const [ id, depth ] of Object.entries(this.parent.depths)) {
					if (depth > 0) {
						this.depths[id] = depth === Infinity ? Infinity : depth - 1;
					}
				}
			}

			// get the directory listing and init the fs watcher
			let listing = [];
			try {
				listing = fs.readdirSync(this.path);

				if (!this.fswatcher) {
					this.fswatcher = fs.watch(this.path, { persistent: true }, this.onFSEvent.bind(this));
					this.fswatcher.on('error', err => {
						if (err.code === 'EPERM') {
							this.closeFSWatcher();
						} else if (this.watchers.size) {
							for (const w of this.watchers) {
								w.emit('error', err);
							}
						} else {
							error('Error occurred in fs watcher for %s', highlight(this.path));
							error(err);
						}
					});
					stats.fswatchers++;
					log('Initialized fs watcher: %s (%s)', highlight(this.path), stats.fswatchers);
				}

				this.type &= ~RESTRICTED;
			} catch (e) {
				if (e.code === 'EACCES') {
					this.type |= RESTRICTED;
				} else {
					throw e;
				}
			}

			// all directory nodes must have a clean files map
			if (this.files instanceof Map) {
				this.files.clear();
			} else {
				this.files = new Map();
			}

			// if this node is now restricted, we need to clean up
			if (this.type & RESTRICTED) {
				log('%s is restricted, removing children as we can no longer see them', highlight(this.path));

				const restrictAndCheckIfEmpty = node => {
					let empty = !node.watchers.size;

					node.type |= RESTRICTED;

					for (const [ name, child ] of Object.entries(node.children)) {
						// need to determine if the child can be destroyed
						if (restrictAndCheckIfEmpty(child)) {
							child.destroy();
							delete node.children[name];
						} else {
							empty = false;
						}
					}

					return empty;
				};

				// mark all children as restricted
				// if the child has no watchers, it can be removed
				restrictAndCheckIfEmpty(this);

				// make sure we're cleaned up
				this.closeFSWatcher();

			// node is not restricted
			} else {
				log('%s is not restricted, listing and creating child nodes', highlight(this.path));

				if (action === 'add') {
					this.notify({
						action,
						filename: this.name,
						file: this.path
					}, true);
				}

				const now = Date.now();

				// loop over the listing and populate files
				// if this is an 'add', then initialize the child node
				for (const filename of listing) {
					const file = _path.join(this.path, filename);

					this.files.set(filename, now);

					if (action === 'add' || action === 'change') {
						let child = this.children[filename];
						if (child) {
							child.stat();
							child.init(action);
						} else if (Object.values(this.depths).some(depth => depth > 0)) {
							this.addChild(filename, action, true);
						}

						this.notify({
							action,
							filename,
							file
						}, true);
					}
				}

				// if this is an add, then notify all links that this node changed
				if (action === 'add') {
					for (const node of this.links) {
						node.notify({
							action: 'change',
							filename: node.name,
							file: node.path
						});
					}
				}
			}
		}

		if ((isSymlink || !isDir) && (action === 'add' || action === 'change')) {
			this.notify({
				action,
				filename: this.name,
				file: this.path
			}, true);
		}

		let type = isSymlink ? 'l' : '';
		type += isDir ? 'd' : isFile ? 'f' : '?';
		const files = this.files ? `(${pluralize('file', this.files.size, true)})` : '';
		log('Initialized node: %s %s %s', highlight(this.path), green(`[${type}]`), files);

		return this;
	}

	/**
	 * Detects if the node is active by checking if there are any watchers, if any parent node is
	 * watching recursively, or if any child node has active watchers.
	 *
	 * @param {Boolean} recursive - When `true`, checks if any parent node is recursively watching
	 * the current node.
	 * @returns {Boolean}
	 * @access public
	 */
	isActive(recursive) {
		if (this.watchers.size) {
			log('%s is active with %s', highlight(this.realPath), pluralize('watcher', this.watchers.size, true));
			return true;
		}
		if (recursive && this.isParentRecursive()) {
			log('%s is active because of a recursive parent', highlight(this.realPath));
			return true;
		}
		if (this.type & DIRECTORY && (this.link && this.link.isActive() || Object.values(this.children).some(child => child.isActive()))) {
			log('%s is active because child has a watcher', highlight(this.realPath));
			return true;
		}
		return false;
	}

	/**
	 * Checks if any parents are recursively watching this node.
	 *
	 * @returns {Boolean}
	 * @access public
	 */
	isParentRecursive() {
		return this.parent && (this.parent.isRecursive || this.parent.isParentRecursive());
	}

	/**
	 * Determines if this node is subject to recursion.
	 *
	 * @type {Boolean}
	 */
	get isRecursive() {
		return Object.keys(this.depths).length > 0;
	}

	/**
	 * Dispatches a change event to all listeners and parents.
	 *
	 * @param {Object} evt - The fs event object.
	 * @param {Boolean} isCurrentNode - When `true`, notifies all watchers of this node, otherwise
	 * it assumes it's a parent node and watchers should only be notified if the parent is watching
	 * recursively.
	 * @param {Number} [depth=0] - The depth from which the event originated.
	 * @access private
	 */
	notify(evt, isCurrentNode, depth = 0) {
		if ((isCurrentNode && this.watchers.size) || (!isCurrentNode && this.isRecursive)) {
			log('Notifying %s %s: %s → %s', green(this.watchers.size), pluralize('watcher', this.watchers.size), highlight(this.path), highlight(evt.filename));
			for (const watcher of this.watchers) {
				if (watcher.recursive === 0 || watcher.recursive === Infinity || watcher.recursive > depth) {
					try {
						watcher.emit('change', evt);
					} catch (err) {
						watcher.emit('error', err, evt);
					}
				}
			}
		}

		if (this.parent) {
			// Note: this is a pretty chatty log message
			// log('Notifying parent: %s', highlight(this.parent.path));
			this.parent.notify(evt, false, depth + 1);
		} else {
			rootEmitter.emit('change', evt);
		}
	}

	/**
	 * Notifies all child watchers about the `add` or `delete` event.
	 *
	 * @param {Object} evt - The fs event object.
	 * @access private
	 */
	notifyChildWatchers(evt) {
		if (this.watchers.size) {
			log('Notifying %s child %s: %s %s → %s',
				green(this.watchers.size),
				pluralize('watcher', this.watchers.size),
				green(`[${evt.action}]`),
				highlight(this.path),
				highlight(evt.filename));

			for (const watcher of this.watchers) {
				try {
					watcher.emit('change', evt);
				} catch (err) {
					watcher.emit('error', err, evt);
				}
			}
		}
	}

	/**
	 * Recursively stops file system watching on this node and all its descendents.
	 *
	 * @param {Object} evt - The fs event.
	 * @returns {Boolean}
	 * @access private
	 */
	onDeleted(evt) {
		if (this.type === DOES_NOT_EXIST) {
			return false;
		}

		this.type = DOES_NOT_EXIST;

		this.closeFSWatcher();

		const children = Object.values(this.children);
		log('Notifying %s %s they were deleted: %s',
			green(children.length),
			pluralize('child', children.length),
			highlight(this.path));
		for (const child of children) {
			if (child.onDeleted(evt)) {
				child.notifyChildWatchers({
					action: 'delete',
					filename: child.name,
					file: child.path
				});
			} else {
				log('%s was already deleted', highlight(child.path));
			}
			if (!child.watchers.size && !Object.keys(child.children).length) {
				child.destroy();
				delete this.children[child.name];
			}
		}

		if (this.files) {
			log('Sending notifications for %s deleted %s: %s',
				green(this.files.size),
				pluralize('file', this.files.size),
				highlight(this.path));

			for (const filename of this.files.keys()) {
				this.notify({
					action: 'delete',
					filename,
					file: _path.join(this.path, filename)
				}, true);
			}

			this.files.clear();
			delete this.files;
		}

		if (this.link) {
			this.link.links.delete(this);
			this.link = null;
		}

		if (this.links.size) {
			log('Notifying %s %s: %s → %s', green(this.links.size), pluralize('link', this.links.size), highlight(this.path), highlight(evt.filename));
			for (const link of this.links) {
				const type = link.type;
				link.stat();
				if (link.type !== type) {
					link.notify({
						action: 'change',
						filename: link.name,
						file: link.path
					});
				}
			}
		}

		return true;
	}

	/**
	 * Callback for Node's `fs.watch()` that processes the incoming fs event.
	 *
	 * @param {String} event - The event name. This value is either `rename` or `change` and is
	 * mostly useless.
	 * @param {String} filename - The name of the file that triggered the event.
	 * @access private
	 */
	onFSEvent(event, filename) {
		// check that the changed file hasn't been deleted during notification
		/* istanbul ignore if */
		if (filename === null) {
			return;
		}

		try {
			// sanity check that this path still exists because apparently Linux
			// will let the watcher know that itself was deleted
			fs.lstatSync(this.path);
		} catch (e) {
			return;
		}

		const prev = this.files && this.files.get(filename) || null;
		const evt = {
			action: prev ? 'change' : 'add',
			filename,
			file: _path.join(this.path, filename)
		};
		const now = Date.now();
		let isDir = false;
		let child = this.children[filename];

		try {
			const stat = fs.lstatSync(evt.file);
			isDir = stat.isDirectory();

			this.files.set(filename, [ evt.action, now ]);

			if (process.platform === 'win32'
				&& event === 'change'
				&& evt.action === 'change'
				&& isDir
			) {
				// This will drop also events where there is a permission change on the folder,
				// tracked as https://jira.appcelerator.org/browse/DAEMON-232 - EH 02/08/18
				log('Dropping Windows event for change to contents of a directory');
				return;
			}
		} catch (e) {
			if (!prev) {
				return;
			}

			// file was deleted
			evt.action = 'delete';
			if (this.files) {
				this.files.delete(filename);
			}
		}

		if (prev && evt.action !== 'delete' && (prev[1] > 0 && (now - prev[1]) < 100)) {
			log('Dropping redundant event: %s %s → %s', green(`[${evt.action}]`), highlight(this.path), highlight(filename));
			return;
		}

		log('FS Event: %s %s → %s', green(`[${evt.action}]`), highlight(this.path), highlight(filename));

		let notify = true;

		if (child) {
			log('Notifying child node: %s', highlight(filename));
			if (evt.action === 'delete') {
				if (child.onDeleted(evt)) {
					child.notifyChildWatchers(evt);
				} else {
					log('%s was already deleted', highlight(child.path));
				}
				if (!child.watchers.size && !Object.keys(child.children).length) {
					delete this.children[child.name];
					child.destroy();
				}
			} else {
				child.stat();
				child.init(evt.action);
			}
		} else if (evt.action === 'add' && (this.isRecursive || this.isParentRecursive())) {
			notify = !this.addChild(filename, 'add', true);
		}

		if (notify) {
			this.notify(evt, true);
		}
	}

	/**
	 * Recursively descends all child nodes and decrements the recursive counter.
	 *
	 * @param {FSWatcher} watcher - The FSWatcher instance.
	 * @param {Number} depth - The depth to stop recursively watching.
	 * @access private
	 */
	recursiveUnwatch(watcher, depth) {
		delete this.depths[watcher.id];

		if (this.type & DIRECTORY && this.files) {
			for (const [ filename ] of this.files) {
				let child = this.children[filename];
				if (child) {
					child.recursiveUnwatch(watcher, depth === Infinity ? Infinity : depth - 1);
				}
			}
		}
	}

	/**
	 * Recursively descends all child nodes and increments the recursive counter.
	 *
	 * @param {Number} depth - The depth to stop recursively watching.
	 * @access private
	 */
	recursiveWatch(depth) {
		if (this.type & DIRECTORY && this.files && depth > 0) {
			if (depth !== Infinity) {
				depth--;
			}

			for (const [ filename ] of this.files) {
				let child = this.children[filename];
				if (!child) {
					child = new Node(_path.join(this.path, filename), this);
					if (!(child.type & DIRECTORY) && !(child.type & SYMLINK)) {
						stats.nodes--;
						// log('Decrementing stats.nodes to %s %s', stats.nodes, highlight(this.path));
						continue;
					}
					this.children[filename] = child;
					child.init();
				}
				child.recursiveWatch(depth);
			}
		}
	}

	/**
	 * Stats the path and determines if the path is a directory, file, symlink, or non-existent.
	 * Also checks if the file can be accessed or if its restricted.
	 *
	 * @access private
	 */
	stat() {
		try {
			const lstat = fs.lstatSync(this.path);
			if (lstat.isSymbolicLink()) {
				this.type = SYMLINK;
				try {
					const stat = fs.statSync(this.path);
					this.realPath = fs.realpathSync(this.path);
					if (stat.isDirectory()) {
						this.type |= DIRECTORY;
					} else if (stat.isFile()) {
						this.type |= FILE;
					}
				} catch (e) {
					// broken symlink, need to read link
					const link = fs.readlinkSync(this.path);
					this.realPath = link.charAt(0) === '.' ? _path.resolve(_path.dirname(this.path), link) : _path.resolve(link);

					// try to re-stat using the real path
					try {
						const stat = fs.statSync(this.realPath);
						if (stat.isDirectory()) {
							this.type |= DIRECTORY;
						} else if (stat.isFile()) {
							this.type |= FILE;
						}
					} catch (e2) {
						// oh well
					}
				}
			} else if (lstat.isDirectory()) {
				this.type = DIRECTORY;
			} else {
				this.type = FILE;
			}
		} catch (e) {
			this.type = DOES_NOT_EXIST;
		}
	}

	/**
	 * Removes the specified watcher from this node.
	 *
	 * @param {FSWatcher} watcher - The FSWatcher instance.
	 * @returns {Node}
	 * @access public
	 */
	unwatch(watcher) {
		if (this.watchers.has(watcher)) {
			stats.watchers--;
			this.watchers.delete(watcher);
			if (watcher.recursive) {
				this.recursiveUnwatch(watcher, watcher.recursive === Infinity ? Infinity : watcher.recursive - 1);
			}
		}
		return this;
	}

	/**
	 * Adds the specified watcher to this node.
	 *
	 * @param {FSWatcher} watcher - The FSWatcher instance.
	 * @returns {Node}
	 * @access public
	 */
	watch(watcher) {
		if (!this.watchers.has(watcher)) {
			stats.watchers++;
			this.watchers.add(watcher);

			if (watcher.recursive) {
				this.depths[watcher.id] = watcher.recursive;
				this.recursiveWatch(watcher.recursive === Infinity ? Infinity : watcher.recursive);
			}
		}
		return this;
	}
}

/**
 * A file system watcher handle that emits `change` events.
 *
 * If the `change` handler throws an error, then it will emit an `error` event.
 */
export class FSWatcher extends EventEmitter {
	/**
	 * Creates an instance and registers it with the specified path.
	 *
	 * @param {String} path - The path to watch.
	 * @param {Object} [opts] - Various options.
	 * @param {Number} [opts.depth] - The maximum depth to recurse. Only used when `opts.recursive`
	 * is `true`.
	 * @param {Boolean} [opts.recursive] - When `true`, any changes to the path or its children emit
	 * a change event.
	 * @access public
	 */
	constructor(path, opts = {}) {
		if (typeof path !== 'string') {
			throw new TypeError('Expected path to be a string');
		}

		if (!opts) {
			opts = {};
		} else if (typeof opts !== 'object') {
			throw new TypeError('Expected options to be an object');
		}

		super();

		/**
		 * The path to watch.
		 * @type {String}
		 */
		this.path = path;

		/**
		 * The unique id for this watcher instance.
		 * @type {Number}
		 */
		this.id = watcherCounter++;

		/**
		 * The path to watch.
		 * @type {Number}
		 */
		this.recursive = 0;
		if (opts.recursive) {
			this.recursive = Infinity;

			if (opts.depth !== undefined) {
				if (typeof opts.depth !== 'number' || isNaN(opts.depth)) {
					throw new TypeError('Expected recursion depth to be a number');
				}
				if (opts.depth < 0) {
					throw new TypeError('Recursion depth must be greater than or equal to zero');
				}
				this.recursive = opts.depth;
			}
		}

		/**
		 * The node associated with the last segment of the specified path. This property is used to
		 * determine if the this `FSWatcher` instance is initialized and watching for fs events.
		 * @type {Node}
		 */
		this.opened = !!register(path, this);
	}

	/**
	 * Closes the watcher and events will stop being omitted.
	 *
	 * @returns {Boolean} Returns `true` if the watcher was successfully closed.
	 * @access public
	 */
	close() {
		const result = this.opened && unregister(this.path, this);
		this.opened = false;
		return result;
	}

	/**
	 * Re-opens the watcher.
	 *
	 * @access public
	 */
	open() {
		if (this.opened) {
			throw new Error('Already open');
		}
		this.opened = !!register(this.path, this);
	}
}

/**
 * Helper function that parses the root and path segments from the specified path.
 *
 * @param {String} path - The path to parse.
 * @returns {Object}
 */
function parsePath(path) {
	if (typeof path !== 'string') {
		throw new TypeError('Expected path to be a string');
	}

	// first we need to resolve the path
	const rpath = _path.resolve(path);

	const m = rpath.match(rootRegExp);
	const root = m && m[1] ? m[1].toUpperCase() : null;

	/* istanbul ignore if */
	if (!root) {
		// NOTE: This line is really hard to unit test since `path.resolve()` seems to always return
		// a valid path.
		throw new Error(`Invalid path "${path}"`);
	}

	return { root, segments: m && m[2] ? m[2].split(_path.sep) : [] };
}

/**
 * Initializes all nodes in the specified `path`, then if applicable it will register the specified
 * `FSWatcher` instance with the last node in the `path`.
 *
 * @param {String} path - The path to watch.
 * @param {FSWatcher} [watcher] - The `FSWatcher` instance.
 * @returns {Node}
 */
export function register(path, watcher) {
	const { root, segments } = parsePath(path);

	if (watcher) {
		if (!(watcher instanceof FSWatcher)) {
			throw new TypeError('Expected watcher to be a FSWatcher instance');
		}

		if (watcher.recursive && !segments.length) {
			throw new Error('Recursively watching root is not permitted');
		}
	}

	// init the root node
	if (!roots[root]) {
		log('Creating root node: %s', highlight(root));
		roots[root] = new Node(root).init();
	}

	log('Registering path: %s', highlight(path));
	let node = roots[root];

	for (const segment of segments) {
		let child = node.getChild(segment);
		if (child) {
			node = child;
		} else {
			node = node.addChild(segment);
		}
		if (node.link) {
			node = node.link;
		}
	}

	if (watcher) {
		node.watch(watcher);
	}

	return node;
}

/**
 * Unregisters a watcher for the specified path.
 *
 * @param {String} path - The path to watch.
 * @param {FSWatcher} watcher - The FSWatcher instance.
 * @returns {Boolean} Returns `true` if the watcher was successfully unregistered.
 */
export function unregister(path, watcher) {
	const { root, segments } = parsePath(path);

	if (watcher && !(watcher instanceof FSWatcher)) {
		throw new TypeError('Expected watcher to be a FSWatcher instance');
	}

	log('Unregistering path: %s', highlight(path));

	// recursively walk the path segments to find the correct node, remove the watcher, then walk
	// backwards to destory inactive nodes
	const result = (function walk(node, segments) {
		let segment;
		let child;
		if (node) {
			segment = segments.shift();
			if (!segment) {
				log('Found %s', highlight(path));

				if (watcher) {
					node.unwatch(watcher);
				}

				return !node.isActive(true);
			}

			log('Scanning %s for %s', highlight(node.path), highlight(segment));

			child = node.getChild(segment);
			if (!child) {
				return false;
			}

			const result = walk(child.link || child, segments);

			if ((result || child.link) && !child.isActive()) {
				if (child.link) {
					unregister(child.link.path);
				}

				child.destroy();
				delete node.children[child.name];

				return true;
			}

			log('Keeping %s', highlight(child.path));
		}
	}(roots[root], segments));

	// check if the root node can be cleaned up
	if (result && roots[root] && !roots[root].isActive()) {
		log('Destroying %s', highlight(roots[root].path));
		roots[root].destroy();
		delete roots[root];
		return true;
	}

	return result;
}

/**
 * A utility function that renders the tree to a string. This function should be invoked without
 * arguments.
 *
 * Note that this function should NOT be called with any arguments.
 *
 * @param {Node} [node] - The tree node to render.
 * @param {Number} [depth=0] - The tree depth counter.
 * @param {Array} [parent] - An stack of parent node labels.
 * @returns {String}
 */
export function renderTree(node, depth = 0, parent = []) {
	let children = node instanceof Node ? node.children : roots;
	const keys = Object.keys(children).sort((a, b) => a.localeCompare(b));
	const len = keys.length;

	if (children === roots && len === 0) {
		return '<empty tree>';
	}

	let i = 0;
	let str = '';

	for (const name of keys) {
		const node = children[name];
		const hasChildren = node.children && Object.keys(node.children).length > 0;
		const last = i + 1 === len;
		const symbol = !depth ? '' : last ? '└─' : '├─';
		let indent = '';
		for (let j = 1; j < depth; j++) {
			indent += (parent[j] ? ' ' : '│') + ' ';
		}
		let type = node.type & SYMLINK ? 'l' : '';
		type += node.type & DIRECTORY ? 'd' : node.type & FILE ? 'f' : '?';

		let meta = [];
		if (node.type & SYMLINK && node.link) {
			meta.push(` → ${highlight(node.link.path)}`);
		}

		let details = [];
		if (node.type & DIRECTORY) {
			const n = node.type & SYMLINK && node.link || node;
			const c = n.files ? n.files.size : '?';
			details.push(`${c} ${pluralize('file', c)}`);
		}
		details.push(pluralize('watcher', node.watchers.size, true));
		details.push(pluralize('link', node.links.size, true));
		const recursive = Object.keys(node.depths).length;
		details.push(`${recursive} recursion${recursive ? ` [depths: ${Object.values(node.depths).map(v => v === Infinity ? '∞' : v).join(' ')}]` : ''}`);
		if (node.type & RESTRICTED) {
			details.push('restricted');
		}
		meta.push(` (${details.join(', ')})`);

		str += ` ${indent}${symbol}${!hasChildren ? '─' : !depth && !i ? '┌' : '┬'} ${green(`[${type}]`)} ${highlight(name)}${meta.join(' ')}\n`;

		i++;

		if (hasChildren) {
			str += renderTree(children[name], depth + 1, parent.concat(last)) + '\n';
		}
	}

	return str.trimRight();
}

/**
 * Resets the entire FSWatcher system. All active watchers will be destroyed.
 */
export function reset() {
	for (const root of Object.keys(roots)) {
		roots[root].destroy();
		delete roots[root];
	}
}

/**
 * Returns stats about the fs watchers.
 *
 * @returns {Object}
 */
export function status() {
	return {
		...JSON.parse(JSON.stringify(stats)),
		tree
	};
}
