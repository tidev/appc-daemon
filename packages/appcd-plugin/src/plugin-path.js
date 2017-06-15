import snooplogg from 'snooplogg';

import { EventEmitter } from 'events';

const logger = snooplogg.config({ theme: 'detailed' })('appcd:plugin:path');

export default class PluginPath extends EventEmitter {
	constructor(pluginPath) {
		super();

		/**
		 * The path this instance is to search and watch for plugins within.
		 * @type {String}
		 */
		this.path = pluginPath;

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
	}

	async destroy() {
	}
}
