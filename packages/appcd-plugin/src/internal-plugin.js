import PluginBase from './plugin-base';

import { AppcdError, codes } from 'appcd-response';

/**
 * Internal plugin implementation logic.
 */
export default class InternalPlugin extends PluginBase {
	/**
	 * Dispatches a request to the plugin's dispatcher.
	 *
	 * @param {Object} ctx - A dispatcher context.
	 * @param {Function} next - A function to continue to next dispatcher route.
	 * @returns {Promise}
	 * @access public
	 */
	dispatch(ctx, next) {
		return this.dispatcher
			.call(ctx.path, ctx)
			.catch(err => {
				if (err instanceof AppcdError && err.statusCode === codes.NOT_FOUND) {
					return next();
				}
				throw err;
			});
	}

	/**
	 * Loads the internal plugin entry point in the sandbox and activates it.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	onStart() {
		return this.activate()
			.catch(err => {
				this.info.error = err.message;
				this.logger.error(err);
				throw err;
			});
	}

	/**
	 * Deactivates the plugin.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async onStop() {
		if (this.module && typeof this.module.deactivate === 'function') {
			try {
				await this.module.deactivate();
			} catch (err) {
				this.logger.error(err);
				throw err;
			}
		}
	}
}
