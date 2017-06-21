import snooplogg from 'snooplogg';

import { EventEmitter } from 'events';
import { expandPath } from 'appcd-path';
import { detectScheme } from './schemes';

const logger = snooplogg.config({ theme: 'detailed' })('appcd:plugin:path');

/*
is dir a plugin?
	yes
		make sure it's not already registered
		add plugin to list of registered plugins
		add plugin to list of path plugins
		watch dir
			if change
				if external
					stop and reinit plugin
				else
					warn
			else if delete
				if external
					stop plugin
				else
					warn
	no
		read dir and for each subdir
			is subdir a plugin?    note: subdir could be a version dir
				yes
					do steps above
				no
					read subdir and for each sub-subdir
						is sub-subdir a plugin?
							yes
								do steps above
*/


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

		this.plugins = {};

		this.scheme = null;

		this.detect();
	}

	/**
	 * Detects the scheme and listens for possible scheme changes and plugins.
	 */
	detect() {
		const SchemeClass = detectScheme(this.path);

		if (this.scheme instanceof SchemeClass) {
			logger.log(`Detecting no scheme change (${SchemeClass.name})`);
			return;
		}

		logger.log(`Detecting scheme change (${this.scheme ? Object.getPrototypeOf(this.scheme).constructor.name : null} => ${SchemeClass.name})`);

		// remove all plugins
		for (const dir of Object.keys(this.plugins)) {
			this.emit('removed', this.plugins[dir]);
			delete this.plugins[dir];
		}

		const scheme = new SchemeClass(this.path)
			.on('change', () => {
				logger.log('File system change, re-detecting scheme');
				this.detect();
			})
			.on('plugin-added', plugin => {
				this.plugins[plugin.path] = plugin;
				this.emit('added', plugin);
			})
			.on('plugin-deleted', plugin => {
				delete this.plugins[plugin.path];
				this.emit('deleted', plugin);
			});

		if (this.scheme) {
			// nuke the old scheme
			this.scheme.destroy();
			delete this.scheme;
		}

		this.scheme = scheme.watch();
	}

	/**
	 * Removes all plugins and stops file system watchers.
	 *
	 * @returns {Promise}
	 */
	async destroy() {
		if (this.scheme) {
			this.scheme.destroy();
		}

		for (const dir of Object.keys(this.plugins)) {
			this.emit('removed', this.plugins[dir]);
			delete this.plugins[dir];
		}
	}
}
