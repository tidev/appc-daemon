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

		super('/:filter*');

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
		return topic || String(params.filter || (data && data.key) || '').replace(/^\//, '').split(/\.|\//).join('.');
	}

	/**
	 * Responds to "call" service requests.
	 *
	 * @param {Object} ctx - A dispatcher request context.
	 * @access private
	 */
	onCall(ctx) {
		const { data, params } = ctx.request;
		let key = (params.filter || '').replace(/^\//, '').split(/\.|\//).join('.');

		if (data && data.action) {
			if (data.key && typeof data.key !== 'string') {
				throw new DispatcherError(codes.BAD_REQUEST, 'Missing or empty key');
			}

			if (data.key) {
				key = data.key.replace(/^\//, '').split(/\.|\//).join('.');
			}

			switch (data.action) {
				case 'ls':
				case 'list':
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

				case 'rm':
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

				case 'push':
					if (!key) {
						throw new DispatcherError(codes.FORBIDDEN, 'Not allowed to push onto config root');
					}
					this.config.push(key, data.value);
					ctx.response = new Response(codes.OK);
					return;

				case 'shift':
					if (!key) {
						throw new DispatcherError(codes.FORBIDDEN, 'Not allowed to shift config root');
					}
					this.config.shift(key);
					ctx.response = new Response(codes.OK);
					return;

				case 'pop':
					if (!key) {
						throw new DispatcherError(codes.FORBIDDEN, 'Not allowed to pop config root');
					}
					this.config.pop(key);
					ctx.response = new Response(codes.OK);
					return;

				case 'unshift':
					if (!key) {
						throw new DispatcherError(codes.FORBIDDEN, 'Not allowed to unshift onto config root');
					}
					this.config.unshift(key, data.value);
					ctx.response = new Response(codes.OK);
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
	 * @param {DispatcherContext} params.ctx - The dispatcher context object.
	 * @param {Function} params.publish - A function used to publish data to a dispatcher client.
	 * @access private
	 */
	initSubscription({ ctx, publish }) {
		const { filter } = ctx.request.params;
		logger.log('Starting config gawk watch: %s', highlight(filter || 'no filter'));
		this.config.watch(filter, publish);
	}

	/**
	 * Handles a new subscriber.
	 *
	 * @param {Object} params - Various parameters.
	 * @param {DispatcherContext} params.ctx - The dispatcher context object.
	 * @param {Function} params.publish - A function used to publish data to a dispatcher client.
	 * @access private
	 */
	onSubscribe({ ctx, publish }) {
		const { filter } = ctx.request.params;
		logger.log('Sending initial config state to subscriber: %s', highlight(filter));
		const node = this.config.get(filter);
		publish(node);
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
