/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import Config, { Joi, JSONStore } from 'config-kit';

export { Joi };

/**
 * The Appc Daemon configuration object.
 */
export default class AppcdConfig extends Config {
	static Runtime = Symbol('runtime');
	static User = Symbol('user');

	/**
	 * Initializes the Appc Daemon configuration and layers.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {Object} [opts.data] - Data to initialize the base and runtime config layers with.
	 * @param {String} [opts.file] - The file to associate with the base layer.
	 * @param {Object} [opts.schema] - A Joi schema or object to compile into a Joi schema.
	 * @access public
	 */
	constructor(opts = {}) {
		const { file } = opts;
		delete opts.file;

		opts.allowNulls = opts.allowNulls !== false;

		super(opts);

		this.layers.add({
			file,
			id: AppcdConfig.User,
			order: 1e9,
			static: true
		});

		this.layers.add({
			id: AppcdConfig.Runtime,
			order: Infinity,
			static: true,
			store: new JSONStore({
				data: opts.data
			})
		});
	}

	/**
	 * Resolves the default config layer.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {String} [opts.action] - The action being performed.
	 * @returns {Symbol|Array.<Symbol>}
	 * @access public
	 */
	resolve({ action } = {}) {
		return action === 'load' || action === 'save' ? AppcdConfig.User : [ AppcdConfig.Runtime, AppcdConfig.User ];
	}
}
