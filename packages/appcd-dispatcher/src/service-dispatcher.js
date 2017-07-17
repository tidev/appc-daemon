import Response, { codes } from 'appcd-response';
import snooplogg, { pluralize, styles } from 'snooplogg';

const logger = snooplogg.config({ theme: 'detailed' })('appcd:dispatcher:service-dispatcher');
const { highlight, note } = styles;

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
 * Formats the request's session id for logging.
 *
 * @param {DispatcherContext} ctx - A dispatcher context.
 * @returns {String}
 */
function sessionId(ctx) {
	return ctx.request && ctx.request.hasOwnProperty('sessionId') ? note(`[${ctx.request.sessionId}] `) : '';
}

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
		 * descriptor containing the session references and the publish function.
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
		const type = ctx.request && ctx.request.type || 'call';
		if (!ServiceHandlerTypes.has(type)) {
			throw new Error(`Invalid service handler type "${type}"`);
		}

		const onType = `on${type.substring(0, 1).toUpperCase() + type.substring(1)}`;

		if (typeof this.instance[onType] === 'function') {
			logger.log('%sInvoking %s handler: %s', sessionId(ctx), onType, highlight(this.path || 'no path'));
			return this[type](ctx);
		}

		logger.log('%sNo %s handler: %s', sessionId(ctx), onType, highlight(this.path || 'no path'));
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
	 * Subscribes the remote session, manages the subscriptions, and invokes the service's
	 * `onSubscribe()` handler.
	 *
	 * @param {DispatcherContext} ctx - A dispatcher context.
	 * @access private
	 */
	subscribe(ctx) {
		const topic = typeof this.instance.getTopic === 'function' && this.instance.getTopic(ctx) || ctx.path;
		let descriptor = this.subscriptions[topic];
		let callOnSubscribe = true;

		if (descriptor) {
			if (descriptor.sessions[ctx.request.sessionId]) {
				logger.log('%sSession already subscribed to %s', sessionId(ctx), highlight(topic));
				ctx.response = new Response(codes.ALREADY_SUBSCRIBED);
				return;
			}

			callOnSubscribe = false;

			logger.log('%sAdding subscription: %s', sessionId(ctx), highlight(topic));

		} else {
			logger.log('%sInitializing new subscription: %s', sessionId(ctx), highlight(topic));

			descriptor = this.subscriptions[topic] = {
				sessions: {},
				publish: message => {
					logger.log('%sPublishing %s to %s',
						sessionId(ctx),
						highlight(topic),
						pluralize('listener', Object.keys(descriptor.sessions).length, true)
					);

					for (const listener of Object.values(descriptor.sessions)) {
						listener(message);
					}
				}
			};
		}

		descriptor.sessions[ctx.request.sessionId] = (message, type, fin) => {
			ctx.response.write({
				message,
				topic,
				type: type || 'event',
				fin
			});
		};

		ctx.response.once('end', () => this.unsubscribe(ctx));
		ctx.response.once('error', err => this.unsubscribe(ctx));

		ctx.response.write({
			message: new Response(codes.SUBSCRIBED),
			topic,
			type: 'subscribe'
		});

		// this has to be done AFTER we send the "subscribe" response
		if (callOnSubscribe) {
			this.instance.onSubscribe(ctx, descriptor.publish);
		}
	}

	/**
	 * Unsubscribes the remote session and invokes the service's `onUnsubscribe()` handler.
	 *
	 * @param {DispatcherContext} ctx - A dispatcher context.
	 * @access private
	 */
	unsubscribe(ctx) {
		const topic = typeof this.instance.getTopic === 'function' && this.instance.getTopic(ctx) || ctx.path;
		let descriptor = this.subscriptions[topic];

		if (!descriptor || !descriptor.sessions[ctx.request.sessionId]) {
			// not subscribed
			if (descriptor) {
				logger.log('%sSession not subscribed to %s', sessionId(ctx), highlight(topic));
			} else {
				logger.log('%sNo subscribers to topic: %s', sessionId(ctx), highlight(topic));
			}

			ctx.response = new Response(codes.NOT_SUBSCRIBED);
			return;
		}

		ctx.response = new Response(codes.UNSUBSCRIBED);

		logger.log('%sUnsubscribing session: %s', sessionId(ctx), highlight(topic));
		descriptor.sessions[ctx.request.sessionId](ctx.response.message, 'unsubscribe', true);
		delete descriptor.sessions[ctx.request.sessionId];

		if (!Object.keys(descriptor.sessions).length) {
			if (this.instance.onUnsubscribe) {
				this.instance.onUnsubscribe(ctx, descriptor.publish);
			}
			logger.log('%sNo more listeners, removing descriptor: %s', sessionId(ctx), highlight(topic));
			delete this.subscriptions[topic];
		}
	}
}
