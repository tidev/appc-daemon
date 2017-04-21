if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import fs from 'fs';
import _path from 'path';
import snooplogg from 'snooplogg';

import { EventEmitter } from 'events';
import { inspect } from 'util';

const log = snooplogg.config({ theme: 'standard' })('appcd:fswatcher').log;
const { highlight, green } = snooplogg.styles;
const { pluralize } = snooplogg;

const pathRegExp = /^(\/|[A-Za-z]+\:\\)(.+)$/;
export const roots = {};

export const DOES_NOT_EXIST = 0;
export const DIRECTORY = 1;
export const FILE = 2;
export const SYMLINK = 4;

class Node {
	constructor(path) {
		this.children = {};
		this.name = _path.basename(path) || path;
		this.path = this.realPath = path;
		this.watchers = new Set;
		this.type = DOES_NOT_EXIST;

		this.init();
	}

	init(isAdd) {
		try {
			const lstat = fs.lstatSync(this.path);

			if (lstat.isDirectory()) {
				if (!this.fswatcher) {
					log('Initializing fs watcher: %s', highlight(this.path));
					this.files = isAdd ? new Set : new Set(fs.readdirSync(this.path));
					this.fswatcher = fs.watch(this.path, { persistent: true }, this.onChange.bind(this));
					this.recursive = 0;
				}
				this.type = DIRECTORY;
			} else {
				if (this.fswatcher) {
					this.fswatcher.close();
					delete this.fswatcher;
				}

				if (lstat.isSymbolicLink()) {
					this.type = SYMLINK;
					try {
						const stat = fs.statSync(this.path);
						this.realPath = fs.realpathSync(this.path);
						if (stat.isDirectory()) {
							this.type |= DIRECTORY;
							this.link = getNode(this.realPath);
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
			}
		} catch(e) {
			// doesn't exist
		}

		let type = this.type & SYMLINK ? 'l' : '';
		type += this.type & DIRECTORY ? 'd' : this.type & FILE ? 'f' : '?';
		const files = this.files ? `(${pluralize('file', this.files.size, true)})` : '';
		log('Initialized node: %s %s %s', highlight(this.path), green(`[${type}]`), files);
	}

	addChild(path, basename) {
		if (!basename) {
			basename = _path.basename(path);
		}
		if (!this.children[basename]) {
			this.children[basename] = new Node(path);
		}
		return this.children[basename];
	}

	getChild(name) {
		return this.children && this.children[name] || null;
	}

	addWatcher(watcher) {
		this.watchers.add(watcher);
	}

	notify(evt) {
		log('Notification: %s %s', green(`[${evt.action}]`), highlight(this.path));
		if (evt.action === 'add') {
			this.init(true);
		}
		if (this.watchers.size) {
			log('Notifying %s %s: %s %s', green(this.watchers.size), pluralize('watcher', this.watchers.size), green(`[${evt.action}]`), highlight(evt.file));
			for (const watcher of this.watchers) {
				watcher.emit('change', evt);
			}
		}
	}

	onChange(event, filename) {
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

		const evt = {
			action: this.files && this.files.has(filename) ? 'change' : 'add',
			filename,
			file: _path.join(this.path, filename)
		};

		try {
			const stat = fs.lstatSync(evt.file);
			if (evt.action === 'add') {
				this.files.add(filename);
			}
		} catch (e) {
			// file was deleted
			evt.action = 'delete';
			if (this.files) {
				this.files.delete(filename);
			}
		}

		log('%s %s → %s', green(`[${evt.action}]`), highlight(this.path), highlight(filename));

		if (this.children && this.children[filename]) {
			log('Notifying child node: %s', highlight(filename));
			this.children[filename].notify(evt);
		}

		if (this.watchers.size) {
			log('Notifying %s %s: %s → %s', green(this.watchers.size), pluralize('watcher', this.watchers.size), highlight(this.path), highlight(filename));
			for (const watcher of this.watchers) {
				watcher.emit('change', evt);
			}
		}
	}

/*
		const child = this.children[filename];
		if (child) {
			// we are interested in this child
		} else {
			// we need to stat the file to see if it's a link
		}

		let isDir = false;

		try {
			const stat = fs.lstatSync(evt.file);
			isDir = (stat.isSymbolicLink() ? fs.statSync(evt.file) : stat).isDirectory();
			this.files.add(filename);
		} catch (e) {
			// file was deleted
			evt.action = 'delete';
			if (this.files) {
				this.files.delete(filename);
			}
		}

		log(`Node.onChange('${event}', '${filename}')`);
		log(`  action = ${evt.action}`);
		log(`  path   = ${this.path}`);
		log(`  file   = ${evt.file}`);

		if (this.children[filename]) {
			if (isDir) {
				this.children[filename].onParentChanged(this, evt);
			} else {
				for (const watcher of this.children[filename].watchers) {
					watcher.emit('change', evt);
				}
			}
		}

		for (const watcher of this.watchers) {
			watcher.emit('change', evt);
		}
	}

	onParentChanged(node, evt) {
		if (evt.type === 'add') {
		} else if (evt.type === 'delete') {
			if (this.fswatcher) {
				log('Stopping fs watcher since path was deleted: %s', this.path);
				this.fswatcher.close();
				this.files = this.fswatcher = this.link = this.linkNode = null;
			}
		}
	}

	watch(watcher, segments) {
		if (!this.fswatcher) {
			try {
				this.files = this.link = this.linkNode = null;

				const stat = fs.lstatSync(this.path);

				if (stat.isSymbolicLink()) {
					// stop decending this path, we need to adjust
					this.link = fs.realpathSync(this.path);
					log('Detected symlink, resolved real path: %s', this.link);
					this.linkNode = register(_path.join(this.link, segments.join(_path.sep)), watcher);
					return this.linkNode;
				}

				if (stat.isDirectory()) {
					log('Initializing fs watcher: %s', this.path);
					this.fswatcher = fs.watch(this.path, { persistent: true }, this.onChange.bind(this));
					this.files = new Set(fs.readdirSync(this.path));
				}
			} catch (e) {
				// doesn't exist
				log('Path doesn\'t exist: %s', this.path);
			}
		}

		if (!segments) {
			segments = watcher.segments.slice();
		}
		const segment = segments.shift();

		// is this the right node?
		if (!segment) {
			this.watchers.add(watcher);
			if (watcher.recursive) {
				this.recursive++;
			}
			return this;
		}

		if (!this.children[segment]) {
			this.children[segment] = new Node(_path.join(this.path, segment));
		}
		return this.children[segment].watch(watcher, segments);
	}

	unwatch(watcher, segments) {
		if (!segments) {
			segments = watcher.segments.slice();
		}
		const segment = segments.shift();

		// is this the right node?
		if (!segment) {
			this.watchers.delete(watcher);
			if (watcher.recursive) {
				this.recursive--;
			}
			if (this.watchers.size || Object.keys(this.children).length) {
				return true;
			}
			if (this.fswatcher) {
				log('Closing fs watcher: %s', this.path);
				this.fswatcher.close();
				this.fswatcher = null;
			}

		} else if (this.children[segment]) {
			if (this.children[segment].unwatch(watcher, segments)) {
				// a child is still alive
				return true;
			}

			delete this.children[segment];

			if (!Object.keys(this.children).length) {
				if (this.fswatcher) {
					log('Closing fs watcher: %s', this.path);
					this.fswatcher.close();
					this.fswatcher = null;
				}

				if (this.link) {
					this.linkNode.close(watcher, this.link.split(_path.sep));
					this.link = this.linkNode = null;
				}
			}
		}
	}
*/
}

export default class FSWatcher extends EventEmitter {
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

		this.recursive = !!opts.recursive;

		getNode(path).addWatcher(this);

		// print();
	}

	close() {
		// roots[this.root].unwatch(this);
		return this;
	}
}

export function reset() {
	for (const root of Object.keys(roots)) {
		(function close(node) {
			if (node.children) {
				for (const name of Object.keys(node.children)) {
					close(node.children[name]);
				}
			}
			log('Destroying node: %s', highlight(node.path));
			node.fswatcher && node.fswatcher.close();
			node.files && node.files.clear();
			node.watchers && node.watchers.clear();
			for (const key of Object.getOwnPropertyNames(node)) {
				delete node[key];
			}
		}(roots[root]));
		delete roots[root];
	}
}

function getNode(path) {
	// first we need to resolve the path
	path = _path.resolve(path);

	// determine the root
	const m = path.match(pathRegExp);
	const root = m && m[1] ? m[1].toUpperCase() : null;
	if (!root) {
		throw new Error(`Invalid path "${path}"`);
	}

	// init the root node
	if (!roots[root]) {
		log('Creating root node: %s', highlight(root));
		roots[root] = new Node(root);
	}

	log('Registering watch path: %s', highlight(path));
	let node = roots[root];
	for (const segment of m[2].split(_path.sep)) {
		let child = node.getChild(segment);
		if (child) {
			node = child;
		} else {
			node = node.addChild(_path.join(node.path, segment), segment);
		}
		if (node.link) {
			node = node.link;
		}
	}

	return node;
}

export function renderTree(node, depth=0, parent=[]) {
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
		for (var j = 1; j < depth; j++) {
			indent += (parent[j] ? ' ' : '│') + ' ';
		}
		let type = node.type & SYMLINK ? 'l' : '';
		type += node.type & DIRECTORY ? 'd' : node.type & FILE ? 'f' : '?';

		let meta = [];
		if (node.type & SYMLINK && node.link) {
			meta.push(` → ${highlight(node.link.path)}`);
		}
		if (node.type & DIRECTORY) {
			const n = node.type & SYMLINK && node.link || node;
			const c = n.files ? n.files.size : '?';
			meta.push(` (${c} ${pluralize('file', c)})`);
		}

		str += ` ${indent}${symbol}${!hasChildren ? '─' : !depth && !i ? '┌' : '┬'} ${green(`[${type}]`)} ${highlight(name)}${meta.join(' ')}\n`;

		i++;

		if (hasChildren) {
			str += renderTree(children[name], depth + 1, parent.concat(last)) + '\n';
		}
	}

	// if (node.link) {
	// 	console.log(`  Link: ${node.link}`);
	// } else {
	// 	console.log(`  Children: ${Object.keys(node.children).join(', ')}`);
	// 	console.log(`  Files: ${node.files.length}`);
	// 	console.log(`  Recursive: ${node.recursive}`);
	// 	console.log(`  Watching? ${!!node.fswatcher}`);
	// 	console.log(`  Watchers: ${node.watchers.size}`);
	// }

	return str.trimRight();
}
