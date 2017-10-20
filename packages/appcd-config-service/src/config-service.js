import appcdLogger from 'appcd-logger';
import Config from 'appcd-config';
import Response, { codes } from 'appcd-response';

import { DispatcherError, ServiceDispatcher } from 'appcd-dispatcher';

const logger = appcdLogger('appcd:config-service');
const { highlight } = appcdLogger.styles;

/**
 * Exposes a dispatcher service handler for observing and manipulating the config.
 */
export default class ConfigService extends ServiceDispatcher {
	/**
	 * Initalizes the status and kicks off the timers to refresh the dynamic
	 * status information.
	 *
	 * @param {Config} cfg - The initial config object.
	 * @access public
	 */
	constructor(cfg) {
		if (!cfg || !(cfg instanceof Config)) {
			throw new TypeError('Expected config to be a valid config object');
		}

		super();

		/**
		 * The daemon config instance.
		 * @type {Config}
		 */
		this.config = cfg;

		/**
		 * A map of active watch filters.
		 * @type {Object}
		 */
		this.watchers = {};
	}

	/**
	 * Determines the topic for the incoming request.
	 *
	 * @param {DispatcherContext} ctx - The dispatcher request context object.
	 * @returns {String}
	 * @access private
	 */
	getTopic(ctx) {
		const { data, params, topic } = ctx.request;
		return topic || ((params && params.key) || data.key || '').replace(/^\//, '').split(/\.|\//).join('.');
	}

	/**
	 * Responds to "call" service requests.
	 *
	 * @param {Object} ctx - A dispatcher request context.
	 * @access private
	 */
	onCall(ctx) {
		const { data } = ctx.request;
		let key = (ctx.params.key || '').replace(/^\//, '').split(/\.|\//).join('.');

		if (data && data.action) {
			if (data.key && typeof data.key !== 'string') {
				throw new DispatcherError(codes.BAD_REQUEST, 'Missing or empty key');
			}

			if (data.key) {
				key = data.key.replace(/^\//, '').split(/\.|\//).join('.');
			}

			switch (data.action) {
				case 'get':
					break;

				case 'set':
					if (!key) {
						throw new DispatcherError(codes.FORBIDDEN, 'Not allowed to set config root');
					}
					logger.log(`Setting "${key}" to "${data.value}"`);
					this.config.set(key, data.value);
					ctx.response = new Response(codes.OK);
					return;

				case 'delete':
					if (!key) {
						throw new DispatcherError(codes.FORBIDDEN, 'Not allowed to delete config root');
					}
					if (this.config.delete(key)) {
						ctx.response = new Response(codes.OK);
					} else {
						ctx.response = new Response(codes.NOT_FOUND);
					}
					return;

				default:
					throw new DispatcherError(codes.BAD_REQUEST, `Invalid action: ${data.action}`);
			}
		}

		const filter = key && key.split(/\.|\//).join('.') || undefined;
		const node = this.config.get(filter || undefined);
		if (!node) {
			throw new DispatcherError(codes.NOT_FOUND, filter && `Not Found: ${filter}`);
		}
		ctx.response = node;
	}

	/**
	 * nitializes the config watch for the filter.
	 *
	 * @param {Object} params - Various parameters.
	 * @param {String} [params.topic] - The filter to apply.
	 * @param {Function} params.publish - A function used to publish data to a dispatcher client.
	 * @access private
	 */
	initSubscription({ topic: filter, publish }) {
		logger.log('Starting config gawk watch: %s', highlight(filter || 'no filter'));
		this.config.watch(filter, publish);
	}

	/**
	 * Handles a new subscriber.
	 *
	 * @param {Object} params - Various parameters.
	 * @param {String} [params.topic] - The filter to apply.
	 * @param {Function} params.publish - A function used to publish data to a dispatcher client.
	 * @access private
	 */
	onSubscribe({ topic: filter, publish }) {
		publish(this.config.get(filter));
	}

	/**
	 * Stops watching the config updates.
	 *
	 * @param {Object} params - Various parameters.
	 * @param {Function} params.publish - The function used to publish data to a dispatcher client.
	 * This is the same publish function as the one passed to `onSubscribe()`.
	 * @access private
	 */
	destroySubscription({ publish }) {
		logger.log('Removing config gawk watch');
		this.config.unwatch(publish);
	}
}
