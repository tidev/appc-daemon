import snooplogg from 'snooplogg';

import { EventEmitter } from 'events';
import { expandPath } from 'appcd-path';
import { detectScheme } from './schemes';

const { log } = snooplogg.config({ theme: 'detailed' })('appcd:plugin:path');
const { highlight } = snooplogg.styles;

/**
 * Scans and watches a path for plugins, then emits events when plugins are added or removed.
 */
export default class PluginPath extends EventEmitter {
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
	 * Detects the scheme and listens for possible scheme changes and plugins.
	 *
	 * @returns {PluginPath}
	 * @access public
	 */
	detect() {
		const SchemeClass = detectScheme(this.path);

		if (this.scheme instanceof SchemeClass) {
			log(`Detecting no scheme change (${SchemeClass.name})`);
			return;
		}

		log('Detecting scheme change (%s => %s)', highlight(this.scheme ? Object.getPrototypeOf(this.scheme).constructor.name : null), highlight(SchemeClass.name));

		const scheme = new SchemeClass(this.path)
			.on('change', () => {
				log('File system change, re-detecting scheme');
				this.detect();
			})
			.on('plugin-added', plugin => {
				log('Plugin added: %s', highlight(`${plugin.name}@${plugin.version}`));
				this.plugins[plugin.path] = plugin;
				this.emit('added', plugin);
			})
			.on('plugin-deleted', plugin => {
				log('Plugin deleted: %s', highlight(`${plugin.name}@${plugin.version}`));
				delete this.plugins[plugin.path];
				this.emit('removed', plugin);
			});

		if (this.scheme) {
			this.scheme.destroy();
			this.scheme = null;
		}

		this.scheme = scheme.watch();

		return this;
	}

	/**
	 * Removes all plugins and stops file system watchers.
	 *
	 * @access public
	 */
	destroy() {
		if (this.scheme) {
			this.scheme.destroy();
			this.scheme = null;
		}
	}
}
