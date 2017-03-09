if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import snooplogg, { pluralize, styles } from 'snooplogg';

import codes, { statuses } from 'appcd-statuses';

const logger = snooplogg.config({ theme: 'detailed' })('appcd:service');
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

class ServiceHandlerRegistry {
	constructor() {
		this.subscriptions = {};
		this.path          = null;
		this.handlers      = {};

		// need to bind to this instance
		this.handler = this.handler.bind(this);
	}

	handler(ctx, next) {
		const type = ctx.data.type || 'call';
		const onType = `on${type.substring(0, 1).toUpperCase() + type.substring(1)}`;

		if (ServiceHandlerTypes.indexOf(type) !== -1 && this.handlers[onType]) {
			logger.log('%s Invoking %s handler: %s', note(`[${ctx.data.sessionId}]`), onType, highlight(this.path));
			return this[type](ctx);
		}

		logger.log('%s No %s handler, skipping: %s', note(`[${ctx.data.sessionId}]`), onType, highlight(this.path));
		return next();
	}

	call(ctx) {
		return this.handlers.onCall(ctx);
	}

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

			this.handlers.onSubscribe(ctx, descriptor.publish);
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

	unsubscribe(ctx) {
		const topic = ctx.path;
		let descriptor = this.subscriptions[topic];
		let status = codes.UNSUBSCRIBED;

		if (descriptor && descriptor.sessions[ctx.data.sessionId]) {
			logger.log('%s Unsubscribing session: %s', note(`[${ctx.data.sessionId}]`), highlight(topic));
			delete descriptor.sessions[ctx.data.sessionId];

			if (!Object.keys(descriptor.sessions).length) {
				if (this.handlers.onUnsubscribe) {
					this.handlers.onUnsubscribe(ctx, descriptor.publish);
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

	/**
	 * Registers service handlers.
	 *
	 * @param {Object} params - Various parameters.
	 * @param {String} params.path - The service path.
	 * @param {Function} [params.call] - Handler to invoke when this service is called.
	 * @param {Function} [params.subscribe] - Handler to invoke when this service is subscribed to.
	 * @param {Function} [params.unsubscribe] - Handler to invoke when this service is unsubscribed
	 * from.
	 * @returns {Service}
	 * @access private
	 */
	register(params = {}) {
		if (!params || typeof params !== 'object') {
			throw new TypeError('Expected params to be an object');
		}

		if (!params.path || typeof params.path !== 'string') {
			throw new TypeError('Expected path to be a string');
		}

		this.path = (params.path[0] === '/' ? '' : '/') + params.path;

		for (let type of ServiceHandlerTypes) {
			const onType = `on${type.substring(0, 1).toUpperCase() + type.substring(1)}`;
			if (params[onType]) {
				if (typeof params[onType] !== 'function') {
					throw new TypeError(`Expected '${type}' handler to be a function`);
				}
				this.handlers[onType] = params[onType];
			}
		}

		return this;
	}
}

export default class Service {
	constructor() {
		Object.defineProperty(this, 'service', {
			enumerable: true,
			value:      new ServiceHandlerRegistry
		});
	}
}
