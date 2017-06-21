import fs from 'fs';
import globule from 'globule';
import _path from 'path';
import Plugin from './plugin';
import snooplogg from 'snooplogg';

import { debounce } from 'appcd-util';
import { EventEmitter } from 'events';
import { FSWatcher } from 'appcd-fswatcher';
import { isDir } from 'appcd-fs';
import { real } from 'appcd-path';

const { log } = snooplogg.config({ theme: 'detailed' })('appcd:plugin:scheme');
const { highlight } = snooplogg.styles;

/**
 * Base class for a plugin path scheme.
 */
export class Scheme extends EventEmitter {
	/**
	 * Initializes the scheme.
	 *
	 * @param {String} path - The path to watch and scan for plugins.
	 * @access public
	 */
	constructor(path) {
		super();

		/**
		 * The path to watch and detect plugins in.
		 * @type {String}
		 */
		this.path = real(path);

		/**
		 * The file system watcher for this scheme's path.
		 * @type {FSWatcher}
		 */
		this.watchers = {};

		/**
		 * A function to call when a file system event occurs that will emit the `change` event.
		 * @type {Function}
		 */
		this.onChange = debounce(() => this.emit('change'));
	}

	/**
	 * Closes all file system watchers.
	 *
	 * @access public
	 */
	destroy() {
		if (this.watchers) {
			for (const dir of Object.keys(this.watchers)) {
				this.watchers[dir].close();
				delete this.watchers[dir];
			}
			this.watchers = {};
		}
	}
}

/**
 * Watches for a path to exist, become a directory, and be a plugin directory.
 */
export class InvalidScheme extends Scheme {
	/**
	 * Initializes the scheme and starts watching the file system.
	 *
	 * @param {String} path - The path to watch and scan for plugins.
	 * @access public
	 */
	constructor(path) {
		super(path);

		log('Watching invalid scheme: %s', highlight(this.path));
		this.watchers[this.path] = new FSWatcher(this.path);
	}

	/**
	 * Starts listening for file system changes. This is split up from the FSWatcher instantiation
	 * so that the caller (i.e. `PluginPath`) can destroy a previous scheme before calling this
	 * function which will only twiddle watcher counts and not have to stop and restart Node.js
	 * FSWatch instances.
	 *
	 * @returns {InvalidScheme}
	 * @access public
	 */
	watch() {
		this.watchers[this.path].on('change', evt => this.onChange());
		return this;
	}
}

/**
 * Watches a path containing a plugin.
 */
export class PluginScheme extends Scheme {
	/**
	 * Initializes the scheme and starts watching the file system.
	 *
	 * @param {String} path - The path to watch and scan for plugins.
	 * @access public
	 */
	constructor(path) {
		super(path);

		log('Watching plugin scheme: %s', highlight(this.path));
		this.watchers[this.path] = new FSWatcher(this.path);

		/**
		 * A reference to the plugin descriptor for the plugin found in this scheme's path.
		 * @type {Plugin}
		 */
		this.plugin = null;
	}

	/**
	 * Starts listening for file system changes and detects a plugin in the path. This is split up
	 * from the FSWatcher instantiation so that the caller (i.e. `PluginPath`) can destroy a
	 * previous scheme before calling this function which will only twiddle watcher counts and not
	 * have to stop and restart Node.js FSWatch instances.
	 *
	 * @returns {PluginScheme}
	 * @access public
	 */
	watch() {
		this.watchers[this.path]
			.on('change', evt => {
				if (evt.file === this.path && evt.action === 'delete') {
					this.emit('plugin-deleted', this.plugin);
					this.plugin = null;
				}
				this.onChange();
			});

		try {
			this.emit('plugin-added', new Plugin(this.path));
		} catch (e) {
			warn(e);
		}

		return this;
	}
}

/**
 * Watches a directory containing plugins.
 */
export class PluginsDirScheme extends Scheme {
	/**
	 * Initializes the scheme and starts watching the file system.
	 *
	 * @param {String} path - The path to watch and scan for plugins.
	 * @access public
	 */
	constructor(path) {
		super(path);

		log('Watching plugins dir scheme: %s', highlight(this.path));
		this.watchers[this.path] = new FSWatcher(this.path);

		/**
		 * A map of directories to plugin schemes.
		 * @type {Object}
		 */
		this.pluginSchemes = {};

		if (isDir(this.path)) {
			for (const name of fs.readdirSync(this.path)) {
				const dir = _path.join(this.path, name);
				if (isDir(dir)) {
					this.pluginSchemes[dir] = this.createPluginScheme(dir);
				}
			}
		}
	}

	/**
	 * Creates a plugin scheme and wires up the event handlers.
	 *
	 * @param {String} path - The path to assign to the plugin scheme.
	 * @returns {PluginScheme}
	 * @access private
	 */
	createPluginScheme(path) {
		return new PluginScheme(path)
			.on('change', evt => this.onChange())
			.on('plugin-added', plugin => this.emit('plugin-added', plugin))
			.on('plugin-deleted', plugin => this.emit('plugin-deleted', plugin));
	}

	/**
	 * Starts listening for file system changes and detects plugins in the path. This is split up
	 * from the FSWatcher instantiation so that the caller (i.e. `PluginPath`) can destroy a
	 * previous scheme before calling this function which will only twiddle watcher counts and not
	 * have to stop and restart Node.js FSWatch instances.
	 *
	 * @returns {PluginsDirScheme}
	 * @access public
	 */
	watch() {
		this.watchers[this.path]
			.on('change', evt => {
				if (evt.file === this.path) {
					if (evt.action === 'delete') {
						for (const dir of Object.keys(this.pluginSchemes)) {
							this.pluginSchemes[dir].destroy();
							delete this.pluginSchemes[dir];
						}
					}
					this.onChange();
					return;
				}

				switch (evt.action) {
					case 'add':
						if (isDir(evt.file)) {
							this.pluginSchemes[evt.file] = this.createPluginScheme(evt.file).watch();
						}
						break;

					case 'delete':
						if (this.pluginSchemes[evt.file]) {
							this.pluginSchemes[evt.file].destroy();
							delete this.pluginSchemes[evt.file];
						}
						break;
				}
			});

		for (const scheme of Object.values(this.pluginSchemes)) {
			scheme.watch();
		}

		return this;
	}

	/**
	 * Closes all file system watchers and plugin schemes.
	 *
	 * @access public
	 */
	destroy() {
		super.destroy();
		for (const scheme of Object.values(this.pluginSchemes)) {
			scheme.destroy();
		}
	}
}

/**
 * Watches a directory containing directories of plugins.
 */
export class NestedPluginsDirScheme extends Scheme {
	/**
	 * Initializes the scheme and starts watching the file system.
	 *
	 * @param {String} path - The path to watch and scan for plugins.
	 * @access public
	 */
	constructor(path) {
		super(path);

		log('Watching nested plugins dir scheme: %s', highlight(this.path));
		this.watchers[this.path] = new FSWatcher(this.path);

		/**
		 * A map of directories to plugin schemes.
		 * @type {Object}
		 */
		this.pluginSchemes = {};

		if (isDir(this.path)) {
			for (const name of fs.readdirSync(this.path)) {
				const dir = _path.join(this.path, name);
				if (isDir(dir)) {
					this.pluginSchemes[dir] = this.createPluginsDirScheme(dir);
				}
			}
		}
	}

	/**
	 * Creates a plugins dir scheme and wires up the event handlers.
	 *
	 * @param {String} path - The path to assign to the plugin scheme.
	 * @returns {PluginScheme}
	 * @access private
	 */
	createPluginsDirScheme(path) {
		return new PluginsDirScheme(path)
			.on('change', evt => this.onChange())
			.on('plugin-added', plugin => this.emit('plugin-added', plugin))
			.on('plugin-deleted', plugin => this.emit('plugin-deleted', plugin));
	}

	/**
	 * Starts listening for file system changes and detects nested plugins in the path. This is split
	 * up from the FSWatcher instantiation so that the caller (i.e. `PluginPath`) can destroy a
	 * previous scheme before calling this function which will only twiddle watcher counts and not
	 * have to stop and restart Node.js FSWatch instances.
	 *
	 * @returns {NestedPluginsDirScheme}
	 * @access public
	 */
	watch() {
		this.watchers[this.path]
			.on('change', evt => {
				if (evt.file === this.path) {
					if (evt.action === 'delete') {
						for (const dir of Object.keys(this.pluginSchemes)) {
							this.pluginSchemes[dir].destroy();
							delete this.pluginSchemes[dir];
						}
					}
					this.onChange();
					return;
				}

				switch (evt.action) {
					case 'add':
						if (isDir(evt.file)) {
							this.pluginSchemes[evt.file] = this.createPluginsDirScheme(evt.file).watch();
						}
						break;

					case 'delete':
						if (this.pluginSchemes[evt.file]) {
							this.pluginSchemes[evt.file].destroy();
							delete this.pluginSchemes[evt.file];
						}
						break;
				}
			});

		for (const scheme of Object.values(this.pluginSchemes)) {
			scheme.watch();
		}

		return this;
	}

	/**
	 * Closes all file system watchers and plugin schemes.
	 *
	 * @access public
	 */
	destroy() {
		super.destroy();
		for (const scheme of Object.values(this.pluginSchemes)) {
			scheme.destroy();
		}
	}
}

/**
 * Determines the scheme of the specified plugin path.
 *
 * @param {String} dir - The plugin path to check.
 * @returns {Scheme}
 */
export function detectScheme(dir) {
	// globule will throw an error if the `srcBase` is not a directory
	try {
		if (globule.find('./package.json', { srcBase: dir }).length) {
			return PluginScheme;
		}
	} catch (e) {}

	try {
		if (globule.find('./*/package.json', { srcBase: dir }).length) {
			return PluginsDirScheme;
		}
	} catch (e) {}

	try {
		if (globule.find('./*/*/package.json', { srcBase: dir }).length) {
			return NestedPluginsDirScheme;
		}
	} catch (e) {}

	return InvalidScheme;
}
