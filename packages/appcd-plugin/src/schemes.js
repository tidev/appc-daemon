import globule from 'globule';
import Plugin from './plugin';

import { EventEmitter } from 'events';
import { FSWatcher } from 'appcd-fswatcher';
import { real } from 'appcd-path';

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
		this.path = real(path);
		this.watchers = {};
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
		this.watchers[this.path] = new FSWatcher(this.path);
	}

	/**
	 * Starts listening for file system changes.
	 *
	 * @access public
	 * @returns {Scheme}
	 */
	watch() {
		this.watchers[this.path]
			.on('change', evt => {
				// we only care if the directory we're watching is added
				if (evt.action === 'add' && evt.file === this.path) {
					this.emit('change');
				}
			});

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
		this.watchers[this.path] = new FSWatcher(this.path);
	}

	/**
	 * Starts listening for file system changes and detects a plugin in the path.
	 *
	 * @access public
	 * @returns {Scheme}
	 */
	watch() {
		this.watchers[this.path]
			.on('change', evt => {
				// we only care if the directory we're watching is added or deleted
				if ((evt.action === 'add' || evt.action === 'delete') && evt.file === this.path) {
					this.emit('change');
				}
			});

		try {
			this.emit('plugin-added', new Plugin(this.path));
		} catch (e) {
			logger.warn(e);
		}

		return this;
	}
}

/**
 * Watches a directory containing plugins.
 */
export class PluginsDirScheme extends EventEmitter {
	/**
	 * Initializes the scheme and starts watching the file system.
	 *
	 * @param {String} path - The path to watch and scan for plugins.
	 * @access public
	 */
	constructor(path) {
		super(path);
	}

	/**
	 * Starts listening for file system changes and detects plugins.
	 *
	 * @access public
	 * @returns {Scheme}
	 */
	watch() {
		// TODO: watch for new plugin dirs

		// TODO: scan for plugins

		return this;
	}
}

/**
 * Watches a directory containing directories of plugins.
 */
export class NestedPluginsDirScheme extends EventEmitter {
	/**
	 * Initializes the scheme and starts watching the file system.
	 *
	 * @param {String} path - The path to watch and scan for plugins.
	 * @access public
	 */
	constructor(path) {
		super(path);
	}

	/**
	 * Starts listening for file system changes and detects nested plugins.
	 *
	 * @access public
	 * @returns {Scheme}
	 */
	watch() {
		// TODO: watch for new nested plugin dirs

		// TODO: scan for plugins

		return this;
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
