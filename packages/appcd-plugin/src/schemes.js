import appcdLogger from 'appcd-logger';
import fs from 'fs';
import FSWatcher from 'appcd-fswatcher';
import globule from 'globule';
import HookEmitter from 'hook-emitter';
import _path from 'path';
import Plugin from './plugin';

import { debounce } from 'appcd-util';
import { isDir } from 'appcd-fs';
import { PluginMissingAppcdError } from './plugin-error';
import { real } from 'appcd-path';

const { log, warn } = appcdLogger('appcd:plugin:scheme');
const { highlight } = appcdLogger.styles;

const scopeRegExp = /^@[a-z0-9][\w-.]+$/;

/**
 * Base class for a plugin path scheme.
 */
export class Scheme extends HookEmitter {
	/**
	 * The file system watcher for this scheme's path.
	 * @type {Object}
	 */
	watchers = {};

	/**
	 * A function to call when a file system event occurs that will emit the `change` event.
	 * @type {Function}
	 */
	onChange = debounce(() => this.emit('change'));

	/**
	 * Initializes the scheme.
	 *
	 * @param {String} path - The path to watch and scan for plugins.
	 * @access public
	 */
	constructor(path) {
		super();

		/**
		 * The original path which may be a symlink and since we don't want to watch symlinks, we
		 * keep it for reference only.
		 * @type {String}
		 */
		this.origPath = path;

		/**
		 * The path to watch and detect plugins in.
		 * @type {String}
		 */
		this.path = real(path);
	}

	/**
	 * The base implementation that doesn't detect anything.
	 *
	 * @returns {Promise<Array>}
	 * @access public
	 */
	async detect() {
		return [];
	}

	/**
	 * Closes all file system watchers.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async destroy() {
		// stop the debounce
		this.onChange.cancel();

		// stop all filesystem watchers
		for (const dir of Object.keys(this.watchers)) {
			this.watchers[dir].close();
			delete this.watchers[dir];
		}
	}
}

/**
 * Watches for a path to exist, become a directory, and be a plugin directory.
 */
export class InvalidScheme extends Scheme {
	/**
	 * Starts listening for file system changes. This is split up from the FSWatcher instantiation
	 * so that the caller (i.e. `PluginPath`) can destroy a previous scheme before calling this
	 * function which will only twiddle watcher counts and not have to stop and restart Node.js
	 * FSWatch instances.
	 *
	 * @returns {Promise<InvalidScheme>}
	 * @access public
	 */
	async watch() {
		if (!this.watchers[this.path]) {
			log('Watching invalid scheme: %s', highlight(this.path));

			// we have to recursively watch
			this.watchers[this.path] = new FSWatcher(this.path, { depth: 1, recursive: true })
				.on('change', () => this.onChange());
		}
		return this;
	}
}

/**
 * Watches a path containing a plugin.
 */
export class PluginScheme extends Scheme {
	/**
	 * A reference to the plugin descriptor for the plugin found in this scheme's path.
	 * @type {Plugin}
	 */
	plugin = null;

	/**
	 * A function to call when a file system event occurs that will emit the `change` event.
	 * @type {Function}
	 */
	checkIfPlugin = debounce(async () => {
		await this.detect();

		if (this.plugin) {
			await this.emit('plugin-added', this.plugin);
		} else {
			// not a plugin or a bad plugin, emit change and allow redetect
			await this.emit('change');
		}
	});

	/**
	 * Detects the plugin in the defined path.
	 *
	 * @returns {Promise<Array<Plugin>>}
	 * @access public
	 */
	async detect() {
		try {
			this.plugin = new Plugin(this.path, true);
			return [ this.plugin ];
		} catch (e) {
			this.plugin = null;
			if (!(e instanceof PluginMissingAppcdError)) {
				warn(e);
			}
		}
		return [];
	}

	/**
	 * Starts listening for file system changes and detects a plugin in the path. This is split up
	 * from the FSWatcher instantiation so that the caller (i.e. `PluginPath`) can destroy a
	 * previous scheme before calling this function which will only twiddle watcher counts and not
	 * have to stop and restart Node.js FSWatch instances.
	 *
	 * @returns {Promise<PluginScheme>}
	 * @access public
	 */
	async watch() {
		if (this.watchers[this.path]) {
			// already watching
			return this;
		}

		log('Watching plugin scheme: %s', highlight(this.path));
		this.watchers[this.path] = new FSWatcher(this.path);

		this.watchers[this.path]
			.on('change', async evt => {
				if (this.plugin && evt.file === this.path && evt.action === 'delete') {
					this.emit('plugin-deleted', this.plugin);
					this.plugin = null;
					this.onChange();
				} else if (this.plugin && evt.action ===  'change' && evt.file === _path.join(this.path, 'package.json')) {
					const plugin = new Plugin(this.path, true);
					if (plugin.pkgJsonHash !== this.plugin.pkgJsonHash) {
						await this.emit('plugin-deleted', this.plugin);
						this.plugin = plugin;
						await this.emit('plugin-added', this.plugin);
					}
				} else if (!this.plugin) {
					await this.checkIfPlugin();
				} else {
					this.onChange();
				}
			});

		await this.detect();

		if (this.plugin) {
			await this.emit('plugin-added', this.plugin);
		}

		return this;
	}

	/**
	 * Closes all file system watchers and plugin schemes.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async destroy() {
		await Scheme.prototype.destroy.call(this);
		if (this.plugin) {
			await this.emit('plugin-deleted', this.plugin);
			this.plugin = null;
		}
	}
}

/**
 * Watches a directory containing plugins.
 */
export class PluginsDirScheme extends Scheme {
	/**
	 * A map of directories to plugin schemes.
	 * @type {Object}
	 */
	pluginSchemes = {};

	/**
	 * Creates a plugin scheme and wires up the event handlers.
	 *
	 * @param {String} path - The path to assign to the plugin scheme.
	 * @returns {PluginScheme}
	 * @access private
	 */
	createPluginScheme(path) {
		return new PluginScheme(path)
			.on('change', () => this.onChange())
			.on('plugin-added', plugin => this.emit('plugin-added', plugin))
			.on('plugin-deleted', plugin => this.emit('plugin-deleted', plugin));
	}

	/**
	 * Detects plugins in the defined path.
	 *
	 * @returns {Promise.<Array.<Plugin>>}
	 * @access public
	 */
	async detect() {
		const plugins = [];

		if (isDir(this.path)) {
			for (const name of fs.readdirSync(this.path)) {
				const dir = _path.join(this.path, name);
				if (!isDir(dir)) {
					continue;
				}

				if (scopeRegExp.test(name)) {
					for (const packageName of fs.readdirSync(dir)) {
						const packageDir = _path.join(dir, packageName);
						if (isDir(packageDir)) {
							const scheme = this.pluginSchemes[packageDir] = this.createPluginScheme(packageDir);
							plugins.push.apply(plugins, await scheme.detect());
						}
					}
				} else if (!this.pluginSchemes[dir]) {
					const scheme = this.pluginSchemes[dir] = this.createPluginScheme(dir);
					plugins.push.apply(plugins, await scheme.detect());
				}
			}
		}

		return plugins;
	}

	/**
	 * Wires up the scoped directory fs watcher and scans the scoped directory for plugins.
	 *
	 * @param {String} dir - The path to the scoped directory.
	 * @param {Boolean} watch - When `true`, starts watching the scoped directory's subdirectories
	 * to detect plugins. This should only be `true` when a parent directory detects a new scoped
	 * directory being added.
	 * @returns {Promise}
	 * @access private
	 */
	async initScopedDir(dir, watch) {
		const plugins = [];

		if (watch) {
			if (this.watchers[dir]) {
				// already watching
				return plugins;
			}

			// we have a @whatever scoped directory, so we watch it for additions/deletions
			this.watchers[dir] = new FSWatcher(dir);

			this.watchers[dir].on('change', async evt => {
				switch (evt.action) {
					case 'add':
						// only set up the plugin scheme if we're dealing with a directory that is a
						// subdirectory and not the scoped directory
						if (evt.file !== dir && isDir(evt.file)) {
							this.pluginSchemes[evt.file] = this.createPluginScheme(evt.file);
							await this.pluginSchemes[evt.file].watch();
						}
						break;

					case 'delete':
						if (evt.file === dir) {
							// the scoped directory was deleted, clean up the fs watcher and notify the
							// plugin path that the scheme might have changed
							this.watchers[dir].close();
							delete this.watchers[dir];
							this.onChange();
						} else if (this.pluginSchemes[evt.file]) {
							await this.pluginSchemes[evt.file].destroy();
							delete this.pluginSchemes[evt.file];
						}
						break;
				}
			});
		}

		// scan the scoped directory for any packages
		for (const packageName of fs.readdirSync(dir)) {
			const packageDir = _path.join(dir, packageName);
			if (isDir(packageDir)) {
				const scheme = this.pluginSchemes[packageDir] = this.createPluginScheme(packageDir);

				// we only want to watch if this function is triggered via a fs event.
				// the plugin path will kick off the watching.
				if (watch) {
					plugins.push.apply(plugins, await scheme.watch());
				}
			}
		}

		return plugins;
	}

	/**
	 * Starts listening for file system changes and detects plugins in the path. This is split up
	 * from the FSWatcher instantiation so that the caller (i.e. `PluginPath`) can destroy a
	 * previous scheme before calling this function which will only twiddle watcher counts and not
	 * have to stop and restart Node.js FSWatch instances.
	 *
	 * @returns {Promise<PluginsDirScheme>}
	 * @access public
	 */
	async watch() {
		if (this.watchers[this.path]) {
			// already watching
			return this;
		}

		log('Watching plugins dir scheme: %s', highlight(this.path));
		this.watchers[this.path] = new FSWatcher(this.path);

		this.watchers[this.path]
			.on('change', async evt => {
				// if this path is being changed, then emit the change event
				if (evt.file === this.path) {
					this.onChange();
					return;
				}

				// some other file is being changed, so wire up the "add" and unwire the "delete"
				switch (evt.action) {
					case 'add':
						if (isDir(evt.file)) {
							if (scopeRegExp.test(evt.filename)) {
								await this.initScopedDir(evt.file, true);
							} else {
								this.pluginSchemes[evt.file] = this.createPluginScheme(evt.file);
								await this.pluginSchemes[evt.file].watch();
							}
						}
						break;

					case 'delete':
						if (scopeRegExp.test(evt.filename)) {
							for (const file of Object.keys(this.pluginSchemes)) {
								if (file.startsWith(`${evt.file}${_path.sep}`)) {
									await this.pluginSchemes[file].destroy();
									delete this.pluginSchemes[file];
								}
							}
							if (this.watchers[evt.file]) {
								this.watchers[evt.file].close();
								delete this.watchers[evt.file];
							}
						} else if (this.pluginSchemes[evt.file]) {
							await this.pluginSchemes[evt.file].destroy();
							delete this.pluginSchemes[evt.file];
						}
						break;
				}

				// some file or directory in the path changed, so emit the change event
				if (_path.dirname(evt.file) === this.path) {
					this.onChange();
				}
			});

		await this.detect();

		for (const scheme of Object.values(this.pluginSchemes)) {
			await scheme.watch();
		}

		return this;
	}

	/**
	 * Closes all file system watchers and plugin schemes.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async destroy() {
		await Scheme.prototype.destroy.call(this);
		await Promise.all(
			Object
				.values(this.pluginSchemes)
				.map(scheme => scheme.destroy())
		);
	}
}

/**
 * Watches a directory containing directories of plugins.
 */
export class NestedPluginsDirScheme extends Scheme {
	/**
	 * A map of directories to plugin schemes.
	 * @type {Object}
	 */
	pluginSchemes = {};

	/**
	 * Creates a plugins dir scheme and wires up the event handlers.
	 *
	 * @param {String} path - The path to assign to the plugin scheme.
	 * @returns {PluginScheme}
	 * @access private
	 */
	createPluginsDirScheme(path) {
		return new PluginsDirScheme(path)
			.on('change', () => this.onChange())
			.on('plugin-added', plugin => this.emit('plugin-added', plugin))
			.on('plugin-deleted', plugin => this.emit('plugin-deleted', plugin));
	}

	/**
	 * Detects plugins in the defined path.
	 *
	 * @returns {Promise.<Array.<Plugin>>}
	 * @access public
	 */
	async detect() {
		const plugins = [];

		if (isDir(this.path)) {
			for (const name of fs.readdirSync(this.path)) {
				const dir = _path.join(this.path, name);
				if (!isDir(dir)) {
					continue;
				}

				if (scopeRegExp.test(name)) {
					// scope
					for (const packageName of fs.readdirSync(dir)) {
						const packageDir = _path.join(dir, packageName);
						if (isDir(packageDir)) {
							const schema = this.pluginSchemes[packageDir] = this.createPluginsDirScheme(packageDir);
							plugins.push.apply(plugins, await schema.detect());
						}
					}
				} else {
					const schema = this.pluginSchemes[dir] = this.createPluginsDirScheme(dir);
					plugins.push.apply(plugins, await schema.detect());
				}
			}
		}

		return plugins;
	}

	/**
	 * Starts listening for file system changes and detects nested plugins in the path. This is split
	 * up from the FSWatcher instantiation so that the caller (i.e. `PluginPath`) can destroy a
	 * previous scheme before calling this function which will only twiddle watcher counts and not
	 * have to stop and restart Node.js FSWatch instances.
	 *
	 * @returns {Promise<NestedPluginsDirScheme>}
	 * @access public
	 */
	async watch() {
		if (this.watchers[this.path]) {
			// already watching
			return this;
		}

		log('Watching nested plugins dir scheme: %s', highlight(this.path));
		this.watchers[this.path] = new FSWatcher(this.path);

		this.watchers[this.path]
			.on('change', async evt => {
				// if this path is being changed, then emit the change event
				if (evt.file === this.path) {
					this.onChange();
					return;
				}

				// some other file is being changed, so wire up the "add" and unwire the "delete"
				switch (evt.action) {
					case 'add':
						if (isDir(evt.file)) {
							this.pluginSchemes[evt.file] = this.createPluginsDirScheme(evt.file);
							await this.pluginSchemes[evt.file].watch();
						}
						break;

					case 'delete':
						if (this.pluginSchemes[evt.file]) {
							await this.pluginSchemes[evt.file].destroy();
							delete this.pluginSchemes[evt.file];
						}
						break;
				}

				// some file or directory in the path changed, so emit the change event
				if (_path.dirname(evt.file) === this.path) {
					this.onChange();
				}
			});

		await this.detect();

		for (const scheme of Object.values(this.pluginSchemes)) {
			await scheme.watch();
		}

		return this;
	}

	/**
	 * Closes all file system watchers and plugin schemes.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async destroy() {
		await Scheme.prototype.destroy.call(this);
		await Promise.all(
			Object
				.values(this.pluginSchemes)
				.map(scheme => scheme.destroy())
		);
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
	} catch (e) {
		// squelch
	}

	try {
		if (globule.find([ './*/package.json', './@*/*/package.json' ], { srcBase: dir }).length) {
			return PluginsDirScheme;
		}
	} catch (e) {
		// squelch
	}

	try {
		if (globule.find([ './*/*/package.json', './@*/*/*/package.json' ], { srcBase: dir }).length) {
			return NestedPluginsDirScheme;
		}
	} catch (e) {
		// squelch
	}

	return InvalidScheme;
}
