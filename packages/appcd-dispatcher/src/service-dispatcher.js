import codes, { statuses } from 'appcd-statuses';
import snooplogg, { pluralize, styles } from 'snooplogg';

const logger = snooplogg.config({ theme: 'detailed' })('appcd:dispatcher:service-dispatcher');
const { highlight, note } = styles;

/**
 * List of all valid handler types.
 * @type {Array.<String>}
 */
const ServiceHandlerTypes = [
	'call',
	'subscribe',
	'unsubscribe'
];

/**
 * A dispatcher handler designed for exposing an interface for services.
 */
export default class ServiceDispatcher {
	/**
	 * Constructs the service registry.
	 *
	 * @param {String} path - The service path.
	 * @param {Object} instance - A reference to the object containing service methods.
	 * @access public
	 */
	constructor(path, instance) {
		if (!path || typeof path !== 'string') {
			throw new TypeError('Expected path to be a string');
		}
		this.path = (path[0] === '/' ? '' : '/') + path;

		if (!instance || typeof instance !== 'object') {
			throw new TypeError('Expected instance to be an object');
		}
		this.instance = instance;

		this.subscriptions = {};

		// need to bind to this instance
		this.handler = this.handler.bind(this);
	}

	/**
	 * An Appc Dispatcher handler.
	 *
	 * @param {Object} ctx - A dispatcher context.
	 * @param {Function} next - A function to continue to next dispatcher route.
	 * @returns {Promise}
	 * @access public
	 */
	handler(ctx, next) {
		if (this.path) {
			const type = ctx.data.type || 'call';
			const onType = `on${type.substring(0, 1).toUpperCase() + type.substring(1)}`;

			if (ServiceHandlerTypes.indexOf(type) !== -1 && typeof this.instance[onType] === 'function') {
				logger.log('%s Invoking %s handler: %s', note(`[${ctx.data.sessionId}]`), onType, highlight(this.path));
				return this[type](ctx);
			}

			logger.log('%s No %s handler, skipping: %s', note(`[${ctx.data.sessionId}]`), onType, highlight(this.path));
		} else {
			logger.error('%s Service not initialized properly with a path, skipping: %s', note(`[${ctx.data.sessionId}]`));
		}

		return next();
	}

	/**
	 * Invokes the `onCall()` service handler.
	 *
	 * @param {Object} ctx - A dispatcher context.
	 * @returns {Promise}
	 * @access private
	 */
	call(ctx) {
		return this.instance.onCall(ctx);
	}

	/**
	 * Subscribes the remote session, manages the subscriptions, and invokes the `onSubscribe()`
	 * service handler.
	 *
	 * @param {Object} ctx - A dispatcher context.
	 * @access private
	 */
	subscribe(ctx) {
		const topic = ctx.path;
		let descriptor = this.subscriptions[topic];

		if (descriptor) {
			if (descriptor.sessions[ctx.data.sessionId]) {
				logger.log('%s Session already subscribed to %s', note(`[${ctx.data.sessionId}]`), highlight(topic));
				ctx.status = codes.ALREADY_SUBSCRIBED;
				ctx.response = statuses[codes.ALREADY_SUBSCRIBED];
				return;
			}

			logger.log('%s Adding subscription: %s', note(`[${ctx.data.sessionId}]`), highlight(topic));

		} else {
			logger.log('%s Initializing new subscription: %s', note(`[${ctx.data.sessionId}]`), highlight(topic));

			descriptor = this.subscriptions[topic] = {
				sessions: {},
				publish: message => {
					logger.log('%s Publishing %s to %s',
						note(`[${ctx.data.sessionId}]`),
						highlight(topic),
						pluralize('listener', Object.keys(descriptor.sessions).length, true)
					);

					for (const listener of Object.values(descriptor.sessions)) {
						listener(message);
					}
				}
			};

			this.instance.onSubscribe(ctx, descriptor.publish);
		}

		descriptor.sessions[ctx.data.sessionId] = message => ctx.response.write({ topic, message });

		ctx.response.once('end', () => this.unsubscribe(ctx));
		ctx.response.once('error', err => this.unsubscribe(ctx));

		ctx.response.write({
			status: codes.SUBSCRIBED,
			message: statuses[codes.SUBSCRIBED],
			topic,
			type: 'subscribe'
		});
	}

	/**
	 * Unsubscribes the remote session and invokes the `onUnsubscribe()` service handler.
	 *
	 * @param {Object} ctx - A dispatcher context.
	 * @access private
	 */
	unsubscribe(ctx) {
		const topic = ctx.path;
		let descriptor = this.subscriptions[topic];
		let status = codes.UNSUBSCRIBED;

		if (descriptor && descriptor.sessions[ctx.data.sessionId]) {
			logger.log('%s Unsubscribing session: %s', note(`[${ctx.data.sessionId}]`), highlight(topic));
			delete descriptor.sessions[ctx.data.sessionId];

			if (!Object.keys(descriptor.sessions).length) {
				if (this.instance.onUnsubscribe) {
					this.instance.onUnsubscribe(ctx, descriptor.publish);
				}
				logger.log('%s No more listeners, removing descriptor: %s', note(`[${ctx.data.sessionId}]`), highlight(topic));
				delete this.subscriptions[topic];
			}
		} else {
			// not subscribed
			if (descriptor) {
				logger.log('%s Session not subscribed to %s', note(`[${ctx.data.sessionId}]`), highlight(topic));
			} else {
				logger.log('%s No subscribers to topic: %s', note(`[${ctx.data.sessionId}]`), highlight(topic));
			}

			status = codes.NOT_SUBSCRIBED;
		}

		if (!ctx.response._writableState.ended) {
			ctx.response.write({
				status,
				message: statuses[status],
				topic,
				type: 'unsubscribe'
			});
		}
	}
}
