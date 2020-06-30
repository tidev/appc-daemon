import appcdLogger from 'appcd-logger';
import Dispatcher, { DispatcherError } from 'appcd-dispatcher';
import PluginBase from './plugin-base';

const { highlight } = appcdLogger.styles;

/**
 * Internal plugin implementation logic.
 */
export default class InternalPlugin extends PluginBase {
	/**
	 * Dispatches a request to the plugin's dispatcher.
	 *
	 * @param {Object} ctx - A dispatcher context.
	 * @returns {Promise}
	 * @access public
	 */
	async dispatch(ctx) {
		const startTime = new Date();
		this.appcdLogger.log('Sending request: %s', highlight(ctx.path));

		try {
			ctx = await this.dispatcher.call(ctx.path, ctx);
			this.logRequest({ ctx, startTime });
			return ctx;
		} catch (err) {
			if (err instanceof DispatcherError && err.status === 404) {
				this.appcdLogger.log('Plugin did not have handler, passing to next route');
			} else {
				this.logRequest({ ctx, err, startTime });
			}
			throw err;
		}
	}

	/**
	 * Loads the internal plugin entry point in the sandbox and activates it.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async onStart() {
		try {
			await this.activate();
		} catch (err) {
			this.info.error = err.message;
			this.info.stack = err.stack;
			this.logger.error(err);
			throw err;
		}

		await this.init();
	}

	/**
	 * Deactivates the plugin.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async onStop() {
		if (this.configSubscriptionId) {
			try {
				await Dispatcher.call('/appcd/config', {
					sid: this.configSubscriptionId,
					type: 'unsubscribe'
				});
			} catch (err) {
				this.logger.warn('Failed to unsubscribe from config');
				this.logger.warn(err);
			}
		}

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
