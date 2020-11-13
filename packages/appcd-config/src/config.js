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
		if (!opts || typeof opts !== 'object') {
			throw new TypeError('Expected options to be an object');
		}

		super({
			...opts,
			allowNulls: opts.allowNulls !== false,
			file:       undefined,
			layers: [
				{
					file:   opts.file,
					id:     AppcdConfig.User,
					order:  1e9,
					static: true
				},
				{
					id:     AppcdConfig.Runtime,
					order:  Infinity,
					static: true,
					store:  new JSONStore({ data: opts.data })
				}
			]
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
