import appcdLogger from 'appcd-logger';
import pluralize from 'pluralize';
import Response, { codes } from 'appcd-response';

import { v4 as uuidv4 } from 'uuid';

const logger = appcdLogger('appcd:service-dispatcher');
const { highlight, note } = appcdLogger.styles;

/**
 * List of all valid handler types.
 * @type {Array.<String>}
 */
const ServiceHandlerTypes = new Set([
	'call',
	'subscribe',
	'unsubscribe'
]);

/**
 * A dispatcher handler designed for exposing an interface for services.
 */
export default class ServiceDispatcher {
	/**
	 * Constructs the service registry.
	 *
	 * @param {String} [path] - The service path to register the handler to.
	 * @param {Object} instance - A reference to the object containing service methods.
	 * @access public
	 */
	constructor(path, instance) {
		if (this.constructor === ServiceDispatcher) {
			throw new TypeError('ServiceDispatcher is an abstract base class that cannot be directly instantiated and must be extended');
		}

		if (instance === undefined) {
			if (typeof path === 'object') {
				instance = path;
				path = null;
			} else if (path === undefined) {
				path = '/:key*';
				instance = this;
			}
		}

		if (path && typeof path !== 'string' && !(path instanceof RegExp)) {
			throw new TypeError('Expected path to be a string or regexp');
		}

		if (instance === undefined) {
			instance = this;
		} else if (instance === null || typeof instance !== 'object') {
			throw new TypeError('Expected instance to be an object');
		}

		/**
		 * The service path to register the handler to.
		 * @type {String}
		 */
		this.path = path instanceof RegExp ? path : (path ? `${path[0] === '/' ? '' : '/'}${path}` : null);

		/**
		 * An identifier for this dispatcher instance to help with debugging.
		 * @type {String}
		 */
		this.id = uuidv4().substring(0, 8);

		/**
		 * A reference to the object containing service methods.
		 * @type {Object}
		 */
		this.instance = instance;

		/**
		 * A namespace logger for this dispatcher instance.
		 * @type {AppcdLogger}
		 */
		this.logger = logger(this.id);

		/**
		 * A map of subscription ids to topics. This makes it easy to look up the topic from the
		 * subscription id.
		 * @type {Object}
		 */
		this.subscriptions = {};

		/**
		 * A map of topics to the topic descriptor which contains all subscribers and the publish
		 * callback.
		 * @type {Object}
		 */
		this.topics = {};

		// need to bind to this instance
		this.handler = this.handler.bind(this);
	}

	/**
	 * The Dispatcher handler.
	 *
	 * @param {DispatcherContext} ctx - A dispatcher context.
	 * @param {Function} next - A function to continue to next dispatcher route.
	 * @returns {*|Promise}
	 * @access public
	 */
	handler(ctx, next) {
		const subscriptionId = ctx.request && ctx.request.sid || '<>';
		const type = ctx.request && ctx.request.type || 'call';

		if (!ServiceHandlerTypes.has(type)) {
			throw new Error(`Invalid service handler type "${type}"`);
		}

		const onType = `on${type.substring(0, 1).toUpperCase() + type.substring(1)}`;

		if (typeof this.instance[onType] === 'function'
			|| (type === 'subscribe' && typeof this.instance.initSubscription === 'function')
			|| (type === 'unsubscribe' && typeof this.instance.destroySubscription === 'function')
		) {
			this.logger.log('%s Invoking %s handler: %s', note(`[${subscriptionId}]`), type, highlight(this.path || 'no path'));
			return this[type](ctx);
		}

		this.logger.log('%s No %s handler: %s', note(`[${subscriptionId}]`), onType, highlight(this.path || 'no path'));
		return next();
	}

	/**
	 * Invokes the service's `onCall()` handler.
	 *
	 * @param {DispatcherContext} ctx - A dispatcher context.
	 * @returns {*} A response or the context.
	 * @access private
	 */
	call(ctx) {
		return this.instance.onCall(ctx);
	}

	/**
	 * Subscribes the sub and invokes the service's `onSubscribe()` handler.
	 *
	 * @param {DispatcherContext} ctx - A dispatcher context.
	 * @access private
	 */
	subscribe(ctx) {
		const subscriptionId = ctx.request.sid = uuidv4();
		const topic = typeof this.instance.getTopic === 'function' && this.instance.getTopic(ctx) || ctx.realPath || '';
		let descriptor = this.topics[topic];
		const firstSubscription = !descriptor;

		if (descriptor) {
			this.logger.log('%s Adding subscription: %s', note(`[${subscriptionId}]`), highlight(topic || '\'\''));

		} else {
			this.logger.log('%s Initializing new subscription: %s', note(`[${subscriptionId}]`), highlight(topic || '\'\''));

			descriptor = this.topics[topic] = {
				subs: new Map(),
				topic,
				publishAll: message => {
					this.logger.log('%s Publishing%s to %s',
						note(`[${subscriptionId}]`),
						topic ? ` ${highlight(topic || '\'\'')}` : '',
						pluralize('listener', descriptor.subs.size, true)
					);

					for (const [ sid, resp ] of descriptor.subs.entries()) {
						resp.write({
							message,
							sid,
							topic,
							type: 'event'
						});
					}
				}
			};
		}

		this.subscriptions[subscriptionId] = descriptor;
		descriptor.subs.set(subscriptionId, ctx.response);

		const cleanup = err => {
			if (err) {
				this.logger.error(err);
			}

			if (descriptor.subs.has(subscriptionId)) {
				this.logger.log(`Stream ${err ? 'errored' : 'ended'}, cleaning up`);
				descriptor.subs.delete(subscriptionId);
			} else {
				this.logger.log(`Stream ${err ? 'errored' : 'ended'}, subscription already cleaned up`);
			}

			this.unsubscribe(ctx);
		};

		ctx.response.once('end', cleanup);
		ctx.response.once('error', cleanup);

		ctx.response.write({
			message: new Response(codes.SUBSCRIBED),
			sid: subscriptionId,
			topic,
			type: 'subscribe'
		});

		// this has to be done AFTER we send the "subscribe" response

		if (firstSubscription && typeof this.instance.initSubscription === 'function') {
			this.instance.initSubscription({
				ctx,
				publish: descriptor.publishAll,
				sid: subscriptionId,
				topic
			});
		}

		if (typeof this.instance.onSubscribe === 'function') {
			this.instance.onSubscribe({
				ctx,
				publish(message) {
					ctx.response.write({
						message,
						sid: subscriptionId,
						topic,
						type: 'event'
					});
				},
				sid: subscriptionId,
				topic
			});
		}
	}

	/**
	 * Unsubscribes the sub and invokes the service's `onUnsubscribe()` handler.
	 *
	 * @param {DispatcherContext} ctx - A dispatcher context.
	 * @access private
	 */
	unsubscribe(ctx) {
		const subscriptionId = ctx.request.sid;
		if (!subscriptionId) {
			ctx.response = new Response(codes.MISSING_SUBSCRIPTION_ID);
			return;
		}

		if (!Object.prototype.hasOwnProperty.call(this.subscriptions, subscriptionId)) {
			this.logger.log('%s No such subscription found', note(`[${subscriptionId}]`));

			// double check that no topics have this subscription id
			for (const descriptor of Object.values(this.topics)) {
				descriptor.subs.delete(subscriptionId);
			}

			ctx.response = new Response(codes.NOT_SUBSCRIBED);
			return;
		}

		const descriptor = this.subscriptions[subscriptionId];
		const { topic } = descriptor;
		const originalResponse = descriptor.subs.get(subscriptionId);

		this.logger.log('%s Unsubscribing: %s', note(`[${subscriptionId}]`), highlight(topic || '\'\''));
		delete this.subscriptions[subscriptionId];

		const response = new Response(codes.UNSUBSCRIBED);
		ctx.response = response;

		// send the unsubscribe event and close the stream
		try {
			if (originalResponse) {
				descriptor.subs.delete(subscriptionId);

				originalResponse.write({
					message: response,
					sid: subscriptionId,
					topic,
					type: 'unsubscribe'
				});

				this.logger.log('%s Ending response: %s', note(`[${subscriptionId}]`), highlight(topic || '\'\''));
				originalResponse.end();
			}
		} catch (e) {
			// squelch
		}

		if (typeof this.instance.onUnsubscribe === 'function') {
			this.logger.log('%s Calling service\'s onUnsubscribe(): %s', note(`[${subscriptionId}]`), highlight(topic || '\'\''));
			this.instance.onUnsubscribe({
				ctx,
				sid: subscriptionId,
				topic
			});
		}

		if (descriptor.subs.size === 0) {
			this.logger.log('%s No more listeners, removing descriptor: %s', note(`[${subscriptionId}]`), highlight(topic || '\'\''));
			delete this.topics[topic];

			if (typeof this.instance.destroySubscription === 'function') {
				this.logger.log('%s Calling service\'s destroySubscription(): %s', note(`[${subscriptionId}]`), highlight(topic || '\'\''));
				this.instance.destroySubscription({
					ctx,
					publish: descriptor.publishAll,
					sid: subscriptionId,
					topic
				});
			}
		}
	}
}
