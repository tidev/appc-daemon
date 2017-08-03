import fs from 'fs';
import gawk from 'gawk';
import _path from 'path';
import snooplogg from 'snooplogg';

import { debounce } from 'appcd-util';
import { EventEmitter } from 'events';

const { log } = snooplogg.config({ theme: 'standard' })('appcd:fswatcher');
const { highlight, green } = snooplogg.styles;
const { pluralize } = snooplogg;

/**
 * A regex that matches a path's root.
 * @type {RegExp}
 */
const rootRegExp = /^(\/|[A-Za-z]+:\\)(.+)?$/;

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
export const DIRECTORY = 1;
export const FILE = 2;
export const SYMLINK = 4;

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
		stats.nodes++;
		log('Incrementing stats.nodes to ' + stats.nodes);

		this.children = {};
		this.links = new Set();
		this.name = _path.basename(path) || path;
		this.parent = parent || null;
		this.path = this.realPath = path;
		this.recursive = 0;
		this.watchers = new Set();
		this.stat();
	}

	/**
	 * Stats the path and determines if the path is a directory, file, symlink, or non-existent.
	 *
	 * @access private
	 */
	stat() {
		try {
			const lstat = fs.lstatSync(this.path);
			if (lstat.isDirectory()) {
				this.type = DIRECTORY;
			} else if (lstat.isSymbolicLink()) {
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
					this.realPath = _path.isAbsolute(link) ? link : _path.join(_path.dirname(this.path), link);
				}
			} else {
				this.type = FILE;
			}
		} catch (e) {
			this.type = DOES_NOT_EXIST;
		}
	}

	/**
	 * Initializes the node by starting the actual fs watch and listing of files when the node is a
	 * directory, or registers the real path if this node is a symlink.
	 *
	 * @param {Boolean} isAdd - When `true` and this node is a directory, it will stat and
	 * initialize any existing watched child nodes.
	 * @returns {Node}
	 * @access private
	 */
	init(isAdd) {
		if (this.type !== DIRECTORY) {
			/* istanbul ignore if */
			if (this.fswatcher) {
				// NOTE: This should never happen and is very difficult to reproduce in a unit test
				// because there should never be a time where the `type` changes from a directory to
				// a file or symlink without it first being deleted. If there was a glitch and the
				// delete fs event was dropped or there was a race condition with another process,
				// then it's possible that the fswatcher is still active and then this code will
				// save the day.
				this.fswatcher.close();
				delete this.fswatcher;
				stats.fswatchers--;
			}

			if (this.type & SYMLINK) {
				this.link = register(this.realPath);
				this.link.links.add(this);
			}

		} else if (!this.fswatcher) {
			log('Initializing fs watcher: %s', highlight(this.path));
			this.fswatcher = fs.watch(this.path, { persistent: true }, this.onFSEvent.bind(this));
			stats.fswatchers++;

			const now = Date.now();
			this.files = new Map();

			for (const filename of fs.readdirSync(this.path)) {
				const file = _path.join(this.path, filename);
				this.files.set(filename, now);

				if (isAdd) {
					const child = this.children[filename];
					if (child) {
						child.stat();
						child.init(true);
					}

					this.notify({
						action: 'add',
						filename,
						file
					}, true);
				}
			}

			if (isAdd) {
				for (const node of this.links) {
					node.notify({
						action: 'change',
						filename: node.name,
						file: node.path
					});
				}
			}
		}

		let type = this.type & SYMLINK ? 'l' : '';
		type += this.type & DIRECTORY ? 'd' : this.type & FILE ? 'f' : '?';
		const files = this.files ? `(${pluralize('file', this.files.size, true)})` : '';
		log('Initialized node: %s %s %s', highlight(this.path), green(`[${type}]`), files);

		return this;
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
			log('Decrementing stats.nodes to ' + stats.nodes);

			if (this.fswatcher) {
				// log('destroy() Closing fs watcher: %s', highlight(this.path));
				this.fswatcher.close();
				delete this.fswatcher;
				stats.fswatchers--;
			}

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
	 * @param {Node} node - The child node.
	 * @returns {Node} The child node.
	 * @access public
	 */
	addChild(node) {
		node.parent = this;
		return this.children[node.name] = node;
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
				this.recursive++;
				this.recursiveWatch(watcher.recursive === Infinity ? Infinity : watcher.recursive - 1);
			}
		}
		return this;
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
					if (child.type !== DIRECTORY && child.type !== SYMLINK) {
						stats.nodes--;
						log('Decrementing stats.nodes to ' + stats.nodes);
						continue;
					}
					this.children[filename] = child.init();
				}
				child.recursiveWatch(depth);
			}
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
				this.recursive--;
				this.recursiveUnwatch(watcher.recursive === Infinity ? Infinity : watcher.recursive - 1);
			}
		}
		return this;
	}

	/**
	 * Recursively descends all child nodes and decrements the recursive counter.
	 *
	 * @param {Number} depth - The depth to stop recursively watching.
	 * @access private
	 */
	recursiveUnwatch(depth) {
		if (this.type & DIRECTORY && this.files) {
			for (const [ filename ] of this.files) {
				let child = this.children[filename];
				if (child) {
					child.recursiveUnwatch(depth === Infinity ? Infinity : depth - 1);
				}
			}
		}
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
		let isFile = false;

		try {
			const stat = fs.lstatSync(evt.file);
			isFile = stat.isFile();
			this.files.set(filename, [ evt.action, now ]);
		} catch (e) {
			// file was deleted
			evt.action = 'delete';
			if (this.files) {
				this.files.delete(filename);
			}
		}

		if (prev && evt.action !== 'delete' && (prev[1] > 0 && (now - prev[1]) < 16)) {
			log('Dropping redundant event: %s %s → %s', green(`[${evt.action}]`), highlight(this.path), highlight(filename));
			return;
		}

		log('FS Event: %s %s → %s', green(`[${evt.action}]`), highlight(this.path), highlight(filename));

		let child = this.children[filename];
		if (child) {
			log('Notifying child node: %s', highlight(filename));
			child.notifyChild(evt);
		} else if (evt.action === 'add' && !isFile && (this.recursive > 0 || this.isParentRecursive())) {
			log('Creating node for %s', highlight(evt.file));
			this.children[filename] = new Node(evt.file, this).init();
		}

		this.notify(evt, true);
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
		if ((isCurrentNode && this.watchers.size) || (!isCurrentNode && this.recursive > 0)) {
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
	 * Called when the parent is receives an event related to this node. When the event was an
	 * `add`, it will stat and init this node. When the event is a `delete`, it stops watching the
	 * now non-existent directory/file.
	 *
	 * @param {Object} evt - The fs event object.
	 * @access private
	 */
	notifyChild(evt) {
		if (evt.action === 'delete') {
			this.onDeleted(evt);
			this.notifyChildWatchers(evt);
		} else {
			this.notifyChildWatchers(evt);
			this.stat();
			this.init(evt.action === 'add');
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
	 * @access private
	 */
	onDeleted(evt) {
		if (this.fswatcher) {
			// log('onDeleted() Closing fs watcher: %s', highlight(this.path));
			this.fswatcher.close();
			delete this.fswatcher;
			stats.fswatchers--;
		}

		this.type = DOES_NOT_EXIST;

		const children = Object.values(this.children);
		if (children) {
			log('Notifying %s %s they were deleted: %s',
				green(children.length),
				pluralize('child', children.length),
				highlight(this.path));

			for (const child of children) {
				child.onDeleted(evt);
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
	}

	/**
	 * Checks if any parents are recursively watching this node.
	 *
	 * @returns {Boolean}
	 * @access public
	 */
	isParentRecursive() {
		return this.parent && (this.parent.recursive > 0 || this.parent.isParentRecursive());
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

		this.opened = !!register(path, this);
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
 * Registers a watcher to the specified path.
 *
 * @param {String} path - The path to watch.
 * @param {FSWatcher} watcher - The FSWatcher instance.
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
			node = node.addChild(new Node(_path.join(node.path, segment)).init());
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
		details.push(`${node.recursive} recursion`);
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
