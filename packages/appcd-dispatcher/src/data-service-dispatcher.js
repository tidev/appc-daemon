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
	 * @param {String} [path="/:filter*"] - The path to bind this service to. By default, this
	 * service dispatcher is similar to a leaf node in a tree. In other words, it will match
	 * every route and no other route will be processed after. If you want this route to be like
	 * a normal route, then set the path to an empty string.
	 * @access public
	 */
	constructor(data = {}, path = '/:filter*') {
		if (!data || typeof data !== 'object') {
			throw new TypeError('Expected data to be an object or array');
		}

		super(path);

		/**
		 * The data store object.
		 * @type {Object}
		 */
		this.data = gawk(data);

		/**
		 * A namespace logger for this dispatcher instance.
		 * @type {AppcdLogger}
		 */
		this.logger = logger(this.id);
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
		this.logger.log('Removing gawk watch');
		gawk.unwatch(this.data, publish);
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
				if (!Object.prototype.hasOwnProperty.call(result, filter[i])) {
					return null;
				}
				result = result[filter[i]];
			}
		}

		return result;
	}

	/**
	 * Scrubs the filter from the request params or returns `null`.
	 *
	 * @param {DispatcherContext} ctx - A dispatcher request context.
	 * @returns {Array.<String>|null}
	 * @access private
	 */
	getFilter(ctx) {
		// if the data service dispatcher has a custom `path` that does not have any parameters,
		// then the `Dispatcher` will set the params to the regex match for the path which just
		// so happens to have a `filter()` method, so we must check that we have a plain params
		// object with a `filter` property
		const params = ctx.request?.params;
		if (params && typeof params === 'object' && !Array.isArray(params) && params.filter && typeof params.filter === 'string') {
			return params.filter.replace(/^\//, '').split(/\//);
		}
		return null;
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
	 * Initializes the subscription for the filter.
	 *
	 * @param {Object} params - Various parameters.
	 * @param {DispatcherContext} params.ctx - The dispatcher context object.
	 * @param {Function} params.publish - A function used to publish data to a dispatcher client.
	 * @access private
	 */
	initSubscription({ ctx, publish }) {
		const filter = this.getFilter(ctx);
		this.logger.log('Starting gawk watch: %s', highlight(filter && filter.join('.') || 'no filter'));
		gawk.watch(this.data, filter, publish);
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
	 * Handles the new subscriber.
	 *
	 * @param {Object} params - Various parameters.
	 * @param {DispatcherContext} params.ctx - The dispatcher context object.
	 * @param {Function} params.publish - A function used to publish data to a dispatcher client.
	 * @access private
	 */
	onSubscribe({ ctx, publish }) {
		const filter = this.getFilter(ctx);
		this.logger.log('Sending initial state to subscriber: %s', highlight(filter && filter.join('.') || 'no filter'));
		publish(this.get(filter));
	}

	/**
	 * Replaces the current data object with a new data object.
	 *
	 * @param {Object} data - The new data object
	 * @access public
	 */
	setData(data) {
		gawk.set(this.data, data);
	}
}
