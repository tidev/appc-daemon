/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import appcdLogger from 'appcd-logger';
import Response, { codes } from 'appcd-response';

import { DispatcherError, ServiceDispatcher } from 'appcd-dispatcher';

const { error, log } = appcdLogger('appcd:config-service');
const { highlight } = appcdLogger.styles;

const writeRegExp = /^set|delete|push|pop|shift|unshift$/;

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
		if (!cfg || typeof cfg !== 'object') {
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
		return topic || String((params && params.filter) || (data && data.key) || '').replace(/^\//, '').split(/\.|\//).join('.');
	}

	/**
	 * Responds to "call" service requests.
	 *
	 * @param {Object} ctx - A dispatcher request context.
	 * @returns {Promise}
	 * @access private
	 */
	async onCall(ctx) {
		const { data, params } = ctx.request;
		let key = (params && params.filter || '').trim().replace(/^\//, '').split(/\.|\//).join('.');

		if (data && data.action) {
			if (data.key) {
				if (typeof data.key !== 'string') {
					throw new DispatcherError(codes.BAD_REQUEST, 'Missing or empty key');
				}
				key = data.key.trim().replace(/^\//, '').split(/\.|\//).join('.');
			}

			const { action } = data;

			log(`Handling ${highlight(action)} request`);

			if (action === 'get') {
				// fall through

			} else if (action === 'load') {
				this.config.load(data.file, {
					id:        data.id || data.namespace,
					namespace: data.namespace || data.id,
					readonly:  data.readonly,
					schema:    data.schema
				});

			} else if (action === 'unload') {
				this.config.unload(data.id || data.namespace);

			} else if (writeRegExp.test(action)) {
				// performing a modifying action

				if (!key) {
					throw new DispatcherError(codes.FORBIDDEN, `Not allowed to ${action} config root`);
				}

				ctx.response = new Response(codes.OK);

				try {
					switch (action) {
						case 'set':
							log(`Setting "${key}" to ${JSON.stringify(data.value)}`);
							this.config.set(key, data.value);
							break;

						case 'delete':
							this.config.delete(key);
							break;

						case 'push':
							this.config.push(key, data.value);
							break;

						case 'pop':
							ctx.response = this.config.pop(key);
							break;

						case 'shift':
							ctx.response = this.config.shift(key);
							break;

						case 'unshift':
							this.config.unshift(key, data.value);
							break;
					}
				} catch (e) {
					error(e.stack);
					throw new DispatcherError(codes.BAD_REQUEST, e.message);
				}

				this.config.save({ file: data.file });
				return;

			} else {
				throw new DispatcherError(codes.BAD_REQUEST, `Invalid action: ${action}`);
			}
		}

		const filter = key && key.split(/\.|\//).filter(Boolean).join('.') || undefined;
		if (filter) {
			log('Filtering config:', filter);
		}
		// log(this.config.toString());
		const node = this.config.get(filter || undefined);
		if (node === undefined) {
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
		log('Starting config gawk watch: %s', highlight(filter || 'no filter'));
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
		log('Sending initial config state to subscriber: %s', highlight(filter || 'no filter'));
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
		log('Removing config gawk watch');
		this.config.unwatch(publish);
	}
}
