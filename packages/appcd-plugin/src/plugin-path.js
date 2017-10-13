import appcdLogger from 'appcd-logger';
import HookEmitter from 'hook-emitter';

import { expandPath } from 'appcd-path';
import { detectScheme } from './schemes';

const { log } = appcdLogger('appcd:plugin:path');
const { highlight } = appcdLogger.styles;

/**
 * Scans and watches a path for plugins, then emits events when plugins are added or removed.
 */
export default class PluginPath extends HookEmitter {
	/**
	 * Initializes the instance and scans the path for plugins.
	 *
	 * @param {String} pluginPath - The path to scan for plugins.
	 * @access public
	 */
	constructor(pluginPath) {
		if (!pluginPath || typeof pluginPath !== 'string') {
			throw new TypeError('Expected plugin path to be a non-empty string');
		}

		super();

		/**
		 * The path this instance is to search and watch for plugins within.
		 * @type {String}
		 */
		this.path = expandPath(pluginPath);

		/**
		 * A map of plugin paths to plugin descriptor objects.
		 * @type {Object}
		 */
		this.plugins = {};

		/**
		 * The active plugin path scheme.
		 * @type {Scheme}
		 */
		this.scheme = null;
	}

	/**
	 * Detects the scheme and listens for possible scheme changes and plugins. This function should
	 * should be invoked after the caller has added event listeners.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async detect() {
		const SchemeClass = detectScheme(this.path);

		if (this.scheme instanceof SchemeClass) {
			log(`Detected no scheme change (${SchemeClass.name})`);
			return;
		}

		log('Detecting scheme change (%s => %s)', highlight(this.scheme ? Object.getPrototypeOf(this.scheme).constructor.name : null), highlight(SchemeClass.name));

		const scheme = new SchemeClass(this.path)
			.on('change', async () => {
				log('File system change, re-detecting scheme');
				await this.detect();
			})
			.on('plugin-added', async (plugin) => {
				log('Plugin added: %s', highlight(`${plugin.name}@${plugin.version}`));
				this.plugins[plugin.path] = plugin;
				await this.emit('added', plugin);
			})
			.on('plugin-deleted', async (plugin) => {
				log('Plugin unloaded: %s', highlight(`${plugin.name}@${plugin.version}`));
				await plugin.stop();
				delete this.plugins[plugin.path];
				await this.emit('removed', plugin);
			});

		if (this.scheme) {
			await this.scheme.destroy();
			this.scheme = null;
		}

		this.scheme = scheme.watch();

		return this;
	}

	/**
	 * Removes all plugins and stops file system watchers.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async destroy() {
		if (this.scheme) {
			await this.scheme.destroy();
			this.scheme = null;
		}
	}
}
