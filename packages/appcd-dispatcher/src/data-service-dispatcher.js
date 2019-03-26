import appcdLogger from 'appcd-logger';
import DispatcherError from './dispatcher-error';
import gawk from 'gawk';
import ServiceDispatcher from './service-dispatcher';

import { codes } from 'appcd-response';

const logger = appcdLogger('appcd:data-service-dispatcher');
const { highlight } = appcdLogger.styles;

/**
 * A service provider that serves up a simple data store with filtering.
 */
export default class DataServiceDispatcher extends ServiceDispatcher {
	/**
	 * Initializes the service.
	 *
	 * @param {Object} [data] - The initial dataset.
	 * @access public
	 */
	constructor(data = {}) {
		if (!data || typeof data !== 'object') {
			throw new TypeError('Expected data to be an object or array');
		}

		super('/:filter*');

		/**
		 * The data store object.
		 * @type {Object}
		 */
		this.data = gawk(data);
	}

	/**
	 * Determines the topic for the incoming request.
	 *
	 * @param {DispatcherContext} ctx - The dispatcher request context object.
	 * @returns {String}
	 * @access private
	 */
	getTopic(ctx) {
		const { topic } = ctx.request;
		if (topic) {
			return topic;
		}
		const filter = this.getFilter(ctx);
		return filter ? filter.join('.') : '';
	}

	/**
	 * Responds to "call" service requests.
	 *
	 * @param {DispatcherContext} ctx - A dispatcher request context.
	 * @access private
	 */
	onCall(ctx) {
		const node = this.get(this.getFilter(ctx));
		if (!node) {
			throw new DispatcherError(codes.NOT_FOUND);
		}
		ctx.response = node;
	}

	/**
	 * Initializes the subscription for the filter.
	 *
	 * @param {Object} params - Various parameters.
	 * @param {DispatcherContext} params.ctx - The dispatcher context object.
	 * @param {Function} params.publish - A function used to publish data to a dispatcher client.
	 * @access private
	 */
	initSubscription({ ctx, publish }) {
		const filter = this.getFilter(ctx);
		logger.log('Starting gawk watch: %s', highlight(filter && filter.join('.') || 'no filter'));
		gawk.watch(this.data, filter, publish);
	}

	/**
	 * Handles the new subscriber.
	 *
	 * @param {Object} params - Various parameters.
	 * @param {DispatcherContext} params.ctx - The dispatcher context object.
	 * @param {Function} params.publish - A function used to publish data to a dispatcher client.
	 * @access private
	 */
	onSubscribe({ ctx, publish }) {
		const filter = this.getFilter(ctx);
		logger.log('Sending initial state to subscriber: %s', highlight(filter && filter.join('.') || 'no filter'));
		publish(this.get(filter));
	}

	/**
	 * Handle an unsubscribe and stop watching the data.
	 *
	 * @param {Object} params - Various parameters.
	 * @param {Function} params.publish - The function used to publish data to a dispatcher client.
	 * This is the same publish function as the one passed to `onSubscribe()`.
	 * @access private
	 */
	destroySubscription({ publish }) {
		logger.log('Removing gawk watch');
		gawk.unwatch(this.data, publish);
	}

	/**
	 * Scrubs the filter from the request params or returns `null`.
	 *
	 * @param {DispatcherContext} ctx - A dispatcher request context.
	 * @returns {Array.<String>|null}
	 * @access private
	 */
	getFilter(ctx) {
		const { filter } = ctx.request.params;
		if (filter) {
			return filter.replace(/^\//, '').split(/\//);
		}
		return null;
	}

	/**
	 * Returns the complete or filtered status values.
	 *
	 * Important! This function returns an internal reference and it's critical that the result is
	 * not modified. If you need to modify the status result, then clone it first.
	 *
	 * @param {Array.<String>} [filter] - An array of namespaces used to filter and return a deep
	 * object.
	 * @return {*}
	 * @access private
	 */
	get(filter) {
		let result = this.data;

		if (filter) {
			for (let i = 0, len = filter.length; result && typeof result === 'object' && i < len; i++) {
				if (!result.hasOwnProperty(filter[i])) {
					return null;
				}
				result = result[filter[i]];
			}
		}

		return result;
	}

}
