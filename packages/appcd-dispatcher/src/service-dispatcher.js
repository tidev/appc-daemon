import appcdLogger from 'appcd-logger';
import Response, { codes } from 'appcd-response';
import uuid from 'uuid';

const logger = appcdLogger('appcd:service-dispatcher');
const { highlight, note } = appcdLogger.styles;
const { pluralize } = appcdLogger;

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
		if (instance === undefined) {
			if (typeof path === 'object') {
				instance = path;
				path = null;
			} else if (path === undefined) {
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
		 * A reference to the object containing service methods.
		 * @type {Object}
		 */
		this.instance = instance;

		/**
		 * A map of all active subscriptions. The key is the topic (i.e. path) and the value is the
		 * descriptor containing the subscription references and the publish function.
		 * @type {Object}
		 */
		this.subscriptions = {};

		// need to bind to this instance
		this.handler = this.handler.bind(this);
	}

	/**
	 * An Appc Dispatcher handler.
	 *
	 * @param {DispatcherContext} ctx - A dispatcher context.
	 * @param {Function} next - A function to continue to next dispatcher route.
	 * @returns {Promise}
	 * @access public
	 */
	handler(ctx, next) {
		const subscriptionId = ctx.request && ctx.request.sid || '<>';
		const type = ctx.request && ctx.request.type || 'call';
		if (!ServiceHandlerTypes.has(type)) {
			throw new Error(`Invalid service handler type "${type}"`);
		}

		const onType = `on${type.substring(0, 1).toUpperCase() + type.substring(1)}`;

		if (typeof this.instance[onType] === 'function') {
			logger.log('%s Invoking %s handler: %s', note(`[${subscriptionId}]`), onType, highlight(this.path || 'no path'));
			return this[type](ctx);
		}

		logger.log('%s No %s handler: %s', note(`[${subscriptionId}]`), onType, highlight(this.path || 'no path'));
		return next();
	}

	/**
	 * Invokes the service's `onCall()` handler.
	 *
	 * @param {DispatcherContext} ctx - A dispatcher context.
	 * @returns {Promise}
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
		const subscriptionId = ctx.request.sid = uuid.v4();
		const topic = typeof this.instance.getTopic === 'function' && this.instance.getTopic(ctx) || ctx.realPath;
		let descriptor = this.subscriptions[topic];
		let callOnSubscribe = true;

		if (descriptor) {
			logger.log('%s Adding subscription: %s', note(`[${subscriptionId}]`), highlight(topic || '\'\''));

			callOnSubscribe = false;

		} else {
			logger.log('%s Initializing new subscription: %s', note(`[${subscriptionId}]`), highlight(topic || '\'\''));

			descriptor = this.subscriptions[topic] = {
				subs: {},
				publish: message => {
					logger.log('%s Publishing%s to %s',
						note(`[${subscriptionId}]`),
						topic ? ` ${highlight(topic || '\'\'')}` : '',
						pluralize('listener', Object.keys(descriptor.subs).length, true)
					);

					for (const listener of Object.values(descriptor.subs)) {
						listener(message);
					}
				}
			};
		}

		// wire up a handler so that unsubscribe will terminate the subscription stream
		descriptor.subs[subscriptionId] = (message, type, fin) => {
			logger.log('%s Subscription has been unsubscribed, sending fin and closing', note(`[${subscriptionId}]`));

			ctx.response.write({
				message,
				sid: subscriptionId,
				topic,
				type: type || 'event'
			});

			if (fin) {
				ctx.response.end();
			}
		};

		const cleanup = err => {
			if (err) {
				logger.error(err);
				logger.log('Stream errored, cleaning up');
			} else {
				logger.log('Stream ended, cleaning up');
			}
			descriptor.subs[subscriptionId] = true;
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
		if (callOnSubscribe) {
			this.instance.onSubscribe(ctx, descriptor.publish);
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

		const topic = typeof this.instance.getTopic === 'function' && this.instance.getTopic(ctx) || ctx.realPath;
		let descriptor = this.subscriptions[topic];

		if (!descriptor || !descriptor.subs[subscriptionId]) {
			// not subscribed
			if (descriptor) {
				logger.log('%s Sub not subscribed to %s', note(`[${subscriptionId}]`), highlight(topic || '\'\''));
			} else {
				logger.log('%s No subscribers to topic: %s', note(`[${subscriptionId}]`), highlight(topic || '\'\''));
			}

			ctx.response = new Response(codes.NOT_SUBSCRIBED);
			return;
		}

		ctx.response = new Response(codes.UNSUBSCRIBED);

		logger.log('%s Unsubscribing sub: %s', note(`[${subscriptionId}]`), highlight(topic || '\'\''));

		if (descriptor.subs[subscriptionId]) {
			if (typeof descriptor.subs[subscriptionId] === 'function') {
				descriptor.subs[subscriptionId](ctx.response, 'unsubscribe', true);
			}
			delete descriptor.subs[subscriptionId];
		}

		if (!Object.keys(descriptor.subs).length) {
			if (this.instance.onUnsubscribe) {
				this.instance.onUnsubscribe(ctx, descriptor.publish);
			}
			logger.log('%s No more listeners, removing descriptor: %s', note(`[${subscriptionId}]`), highlight(topic || '\'\''));
			delete this.subscriptions[topic];
		}
	}
}
