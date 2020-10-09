import appcdLogger from 'appcd-logger';
import HookEmitter from 'hook-emitter';

import { expandPath } from 'appcd-path';
import { detectScheme } from './schemes';
import { debounce } from 'appcd-util';

const { log } = appcdLogger('appcd:plugin:path');
const { highlight, note } = appcdLogger.styles;

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
		 * The redetect scheme debouncer function. We save this so we can cancel a pending bounce
		 * for when we are destroyed.
		 * @type {Function}
		 */
		this.onRedetect = null;

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
			log(`Detected no scheme change (${SchemeClass.name}): ${highlight(this.path)}`);
			return;
		}

		log('Detecting scheme change (%s => %s)', highlight(this.scheme ? Object.getPrototypeOf(this.scheme).constructor.name : null), highlight(SchemeClass.name));

		// we need to get rid of the old scheme before we create a new one
		await this.destroy();

		this.onRedetect = debounce(async () => {
			log(`Redetecting scheme: ${highlight(this.path)}`);
			await this.detect();
		});

		this.scheme = new SchemeClass(this.path)
			.on('redetect-scheme', this.onRedetect)
			.on('plugin-added', async plugin => {
				log(`Plugin added: ${highlight(plugin.toString())} ${note(`(${plugin.path})`)}`);
				this.plugins[plugin.path] = plugin;
				await this.emit('added', plugin);
			})
			.on('plugin-deleted', async plugin => {
				log(`Stopping plugin: ${highlight(plugin.toString())} ${note(`(${plugin.path})`)}`);
				await plugin.stop();

				log(`Plugin unloaded: ${highlight(plugin.toString())} ${note(`(${plugin.path})`)}`);
				delete this.plugins[plugin.path];
				await this.emit('removed', plugin);
			});

		await this.scheme.watch();

		return this;
	}

	/**
	 * Removes all plugins and stops file system watchers.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async destroy() {
		if (this.onRedetect) {
			this.onRedetect.cancel();
			this.onRedetect = null;
		}

		if (this.scheme) {
			await this.scheme.destroy();
			this.scheme = null;
		}
	}
}
