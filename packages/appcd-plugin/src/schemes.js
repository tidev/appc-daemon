import appcdLogger from 'appcd-logger';
import fs from 'fs';
import FSWatcher from 'appcd-fswatcher';
import globule from 'globule';
import HookEmitter from 'hook-emitter';
import _path from 'path';
import Plugin from './plugin';

import { isDir } from 'appcd-fs';
import { PluginMissingAppcdError } from './plugin-error';
import { real } from 'appcd-path';

const { highlight, note } = appcdLogger.styles;

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
	 * Initializes the scheme.
	 *
	 * @param {String} path - The path to watch and scan for plugins.
	 * @access public
	 */
	constructor(path) {
		super();

		/**
		 * The original path, which may be a symlink and since we don't want to watch symlinks, we
		 * keep it separate and use it to initialize the `Plugin` instance.
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
	 * Closes all file system watchers.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async destroy() {
		// stop all filesystem watchers
		for (const dir of Object.keys(this.watchers)) {
			this.watchers[dir].close();
			delete this.watchers[dir];
		}
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
}

/**
 * Watches for a path to exist, become a directory, and be a plugin directory.
 */
export class InvalidScheme extends Scheme {
	/**
	 * Scheme logger namespace.
	 * @type {Object}
	 */
	static logger = appcdLogger('appcd:plugin:invalid-scheme');

	/**
	 * Returns an empty string since this scheme has no plugins.
	 *
	 * @returns {String}
	 * @access public
	 */
	toString() {
		return '';
	}

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
			InvalidScheme.logger.log(`Watching invalid scheme: ${highlight(this.path)}`);

			// we have to recursively watch
			this.watchers[this.path] = new FSWatcher(this.path, { recursive: true })
				.on('change', () => this.emit('redetect-scheme'));
		}
		return this;
	}
}

/**
 * This is a scheme for a single plugin directory.
 */
export class PluginScheme extends Scheme {
	/**
	 * Scheme logger namespace.
	 * @type {Object}
	 */
	static logger = appcdLogger('appcd:plugin:plugin-scheme');

	/**
	 * A reference to the plugin descriptor for the plugin found in this scheme's path.
	 * @type {Plugin}
	 */
	plugin = null;

	/**
	 * Closes all file system watchers and plugin schemes.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async destroy() {
		await super.destroy();
		if (this.plugin) {
			PluginScheme.logger.log(`Destroying scheme, removing plugin: ${highlight(this.path)}`);
			await this.emit('plugin-deleted', this.plugin);
			this.plugin = null;
		}
	}

	/**
	 * Detects the plugin in the defined path.
	 *
	 * @returns {Promise<Array<Plugin>>}
	 * @access public
	 */
	async detect() {
		try {
			const plugin = new Plugin(this.origPath, true);
			if (!this.plugin || this.plugin.path !== plugin.path || this.plugin.name !== plugin.name || this.plugin.version !== plugin.version) {
				this.plugin = plugin;
			}
			return [ this.plugin ];
		} catch (e) {
			this.plugin = null;
			if (!(e instanceof PluginMissingAppcdError)) {
				PluginScheme.logger.warn(e);
			}
		}
		return [];
	}

	/**
	 * Returns a string of this scheme's plugin info or an empty string if this scheme does not
	 * actually contain a plugin.
	 *
	 * @returns {String}
	 * @access public
	 */
	toString() {
		return this.plugin ? `${this.plugin.toString()} (${this.plugin.path})` : '';
	}

	/**
	 * Starts listening for file system changes and detects a plugin in the path. This is split up
	 * from the FSWatcher instantiation so that the caller (i.e. `PluginPath`) can destroy a
	 * previous scheme before calling this function which will only twiddle watcher counts and not
	 * have to stop and restart Node.js FSWatch instances.
	 *
	 * @param {Boolean} [skipDetect] - When true, does not detect the plugins in this scheme.
	 * @returns {Promise<PluginScheme>}
	 * @access public
	 */
	async watch(skipDetect) {
		if (this.watchers[this.path]) {
			// already watching
			PluginScheme.logger.log(`Already watching plugin scheme: ${highlight(this.path)}`);
			return this;
		}

		PluginScheme.logger.log(`Watching plugin scheme: ${highlight(this.path)}`);

		this.watchers[this.path] = new FSWatcher(this.path)
			.on('change', async evt => {
				if (evt.action === 'delete' && this.plugin && evt.file === this.path) {
					PluginScheme.logger.log(`Plugin was deleted from disk, removing: ${highlight(this.path)}`);
					await this.emit('plugin-deleted', this.plugin);
					this.plugin = null;
				} else if (evt.action === 'change' && this.plugin && evt.file === _path.join(this.path, 'package.json')) {
					const plugin = new Plugin(this.path, true);
					if (plugin.pkgJsonHash !== this.plugin.pkgJsonHash) {
						PluginScheme.logger.log(`Plugin ${highlight(this.plugin.toString())} package.json changed, removing and re-adding: ${highlight(this.path)}`);
						await this.emit('plugin-deleted', this.plugin);
						this.plugin = plugin;
						await this.emit('plugin-added', this.plugin);
					}
					return;
				} else if (!this.plugin) {
					try {
						this.plugin = new Plugin(this.origPath, true);
						PluginScheme.logger.log(`Found plugin, adding: ${highlight(this.plugin.toString())} ${note(`(${highlight(this.path)}}`)}`);
						await this.emit('plugin-added', this.plugin);
						return;
					} catch (err) {
						// squelch
					}
				}

				PluginScheme.logger.log(`Plugin directory changed, triggering redirect scheme: [${evt.action}] ${highlight(evt.file.toString())} ${note(`(${highlight(this.path)}}`)}`);
				await this.emit('redetect-scheme');
			});

		if (!skipDetect) {
			await this.detect();
		}

		if (this.plugin) {
			await this.emit('plugin-added', this.plugin);
		}

		return this;
	}
}

/**
 * This is a scheme that is a directory of plugin directories.
 *
 * For example:
 *   ┬─ plugins
 *   └─┬─ @foo/bar
 *     └─ baz
 */
export class PluginsDirScheme extends Scheme {
	/**
	 * Scheme logger namespace.
	 * @type {Object}
	 */
	static logger = appcdLogger('appcd:plugin:plugins-dir-scheme');

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
			.on('redetect-scheme', () => this.emit('redetect-scheme'))
			.on('plugin-added', plugin => this.emit('plugin-added', plugin))
			.on('plugin-deleted', plugin => this.emit('plugin-deleted', plugin));
	}

	/**
	 * Closes all file system watchers and plugin schemes.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async destroy() {
		await super.destroy();
		await Promise.all(
			Object
				.values(this.pluginSchemes)
				.map(scheme => scheme.destroy())
		);
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
						if (isDir(packageDir) && !this.pluginSchemes[packageDir]) {
							this.pluginSchemes[packageDir] = this.createPluginScheme(packageDir);
							plugins.push.apply(plugins, await this.pluginSchemes[packageDir].detect());
						}
					}
				} else if (!this.pluginSchemes[dir]) {
					this.pluginSchemes[dir] = this.createPluginScheme(dir);
					plugins.push.apply(plugins, await this.pluginSchemes[dir].detect());
				}
			}
		}

		return plugins;
	}

	/**
	 * Returns a string of this scheme's plugins.
	 *
	 * @returns {String}
	 * @access public
	 */
	toString() {
		return Object.values(this.pluginSchemes).map(scheme => scheme.toString()).filter(Boolean).join('\n');
	}

	/**
	 * Starts listening for file system changes and detects plugins in the path. This is split up
	 * from the FSWatcher instantiation so that the caller (i.e. `PluginPath`) can destroy a
	 * previous scheme before calling this function which will only twiddle watcher counts and not
	 * have to stop and restart Node.js FSWatch instances.
	 *
	 * @param {Boolean} [skipDetect] - When true, does not detect the plugins in this scheme.
	 * @returns {Promise<PluginsDirScheme>}
	 * @access public
	 */
	async watch(skipDetect) {
		if (this.watchers[this.path]) {
			// already watching
			return this;
		}

		PluginsDirScheme.logger.log(`Watching plugins dir scheme: ${highlight(this.path)}`);

		this.watchers[this.path] = new FSWatcher(this.path, { depth: 1, recursive: true })
			.on('change', async evt => {
				// evt.file could be `<path>/<file>`, `<path>/<dir>`, `<path>/<dir>/<file>`, or `<path>/<dir>/<dir>`
				// we only care when evt.file is `<path>/<dir>` and `<path>/@<scope>/<dir>`

				// if this path is being changed, then we need to redetect the scheme
				if (evt.file === this.path || !isDir(evt.file)) {
					PluginsDirScheme.logger.log(`Directory changed, triggering redetect scheme: ${highlight(evt.file)}`);
					await this.emit('redetect-scheme');
					return;
				}

				const rel = _path.relative(this.path, evt.file).split(/[\\/]/);
				const scoped = scopeRegExp.test(rel[0]);

				if ((scoped && rel.length === 1) || (!scoped && rel.length > 1)) {
					// we don't care about `<path>/@<scope>` and `<path>/<dir>/<dir>`
					PluginsDirScheme.logger.log(`Subdirectory changed, triggering redetect scheme: ${highlight(evt.file)}`);
					await this.emit('redetect-scheme');
					return;
				}

				switch (evt.action) {
					case 'add':
						if (!this.pluginSchemes[evt.file]) {
							PluginsDirScheme.logger.log(`Subdirectory added, creating plugin scheme: ${highlight(evt.file)}`);
							this.pluginSchemes[evt.file] = await this.createPluginScheme(evt.file).watch();
						}
						break;

					case 'delete':
						if (this.pluginSchemes[evt.file]) {
							PluginsDirScheme.logger.log(`Subdirectory deleted, removing plugin scheme: ${highlight(evt.file)}`);
							await this.pluginSchemes[evt.file].destroy();
							delete this.pluginSchemes[evt.file];
						}
						break;
				}
			});

		if (!skipDetect) {
			await this.detect();
		}

		for (const scheme of Object.values(this.pluginSchemes)) {
			await scheme.watch(true);
		}

		return this;
	}
}

/**
 * This is a scheme that is a directory of directories of plugin directories.
 *
 * For example:
 *   ┬─ plugins
 *   └─┬─ @foo/bar
 *     │  ├─ 1.0.0
 *     │  └─ 1.1.0
 *     └─ baz
 *        └─ 2.0.0
 */
export class NestedPluginsDirScheme extends Scheme {
	/**
	 * Scheme logger namespace.
	 * @type {Object}
	 */
	static logger = appcdLogger('appcd:plugin:nested-plugins-dir-scheme');

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
			.on('redetect-scheme', () => this.emit('redetect-scheme'))
			.on('plugin-added', plugin => this.emit('plugin-added', plugin))
			.on('plugin-deleted', plugin => this.emit('plugin-deleted', plugin));
	}

	/**
	 * Closes all file system watchers and plugin schemes.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async destroy() {
		await super.destroy(this);
		await Promise.all(
			Object
				.values(this.pluginSchemes)
				.map(scheme => scheme.destroy())
		);
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
							let scheme = this.pluginSchemes[packageDir];
							if (!scheme) {
								scheme = this.pluginSchemes[packageDir] = this.createPluginsDirScheme(packageDir);
							}
							plugins.push.apply(plugins, await scheme.detect());
						}
					}
				} else {
					let scheme = this.pluginSchemes[dir];
					if (!scheme) {
						scheme = this.pluginSchemes[dir] = this.createPluginsDirScheme(dir);
					}
					plugins.push.apply(plugins, await scheme.detect());
				}
			}
		}

		return plugins;
	}

	/**
	 * Returns a string of this scheme's plugins.
	 *
	 * @returns {String}
	 * @access public
	 */
	toString() {
		return Object.values(this.pluginSchemes).map(scheme => scheme.toString()).filter(Boolean).join('\n');
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

		NestedPluginsDirScheme.logger.log(`Watching nested plugins dir scheme: ${highlight(this.path)}`);

		this.watchers[this.path] = new FSWatcher(this.path, { depth: 1, recursive: true })
			.on('change', async evt => {
				// evt.file could be `<path>/<file>`, `<path>/<dir>`, `<path>/<dir>/<file>`, or `<path>/<dir>/<dir>`
				// we only care when evt.file is `<path>/<dir>` and `<path>/@<scope>/<dir>`

				// if this path is being changed, then emit the change event
				if (evt.file === this.path || !isDir(evt.file)) {
					// signal to check scheme
					NestedPluginsDirScheme.logger.log(`Directory changed, triggering redetect scheme: ${highlight(evt.file)}`);
					await this.emit('redetect-scheme');
					return;
				}

				const rel = _path.relative(this.path, evt.file).split(/[\\/]/);
				const scoped = scopeRegExp.test(rel[0]);

				if ((scoped && rel.length === 1) || (!scoped && rel.length > 1)) {
					// we don't care about `<path>/@<scope>` and `<path>/<dir>/<dir>`
					NestedPluginsDirScheme.logger.log(`Subdirectory changed, triggering redetect scheme: ${highlight(evt.file)}`);
					await this.emit('redetect-scheme');
					return;
				}

				switch (evt.action) {
					case 'add':
						if (!this.pluginSchemes[evt.file]) {
							NestedPluginsDirScheme.logger.log(`Subdirectory added, creating plugin scheme: ${highlight(evt.file)}`);
							this.pluginSchemes[evt.file] = await this.createPluginsDirScheme(evt.file).watch();
						}
						break;

					case 'delete':
						if (this.pluginSchemes[evt.file]) {
							NestedPluginsDirScheme.logger.log(`Subdirectory deleted, removing plugin scheme: ${highlight(evt.file)}`);
							await this.pluginSchemes[evt.file].destroy();
							delete this.pluginSchemes[evt.file];
						}
						break;
				}
			});

		await this.detect();

		for (const scheme of Object.values(this.pluginSchemes)) {
			await scheme.watch(true);
		}

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
