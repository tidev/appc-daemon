import DetectEngine from 'appcd-detect';
import gawk from 'gawk';
import windowslib from 'windowslib';

import * as registry from 'appcd-winreg';

import { codes } from 'appcd-response';
import { DispatcherError, ServiceDispatcher } from 'appcd-dispatcher';
import { exe } from 'appcd-subprocess';

/**
 * The Windows info service.
 */
export default class WindowsInfoService extends ServiceDispatcher {
	/**
	 * Initializes the service path.
	 */
	constructor() {
		super('/:filter*');
	}

	/**
	 * ?
	 *
	 * @param {Config} cfg - An Appc Daemon config object
	 * @returns {Promise}
	 * @access public
	 */
	activate(cfg) {
		// TODO
	}

	/**
	 * ?
	 *
	 * @access public
	 */
	async deactivate() {
		// TODO
	}

	/**
	 * Determines the topic for the incoming request.
	 *
	 * @param {DispatcherContext} ctx - The dispatcher request context object.
	 * @returns {String}
	 * @access private
	 */
	getTopic(ctx) {
		const { params, topic } = ctx.request;
		return topic || (params.filter && params.filter.replace(/^\//, '').split('/').join('.')) || undefined;
	}

	/**
	 * Responds to "call" service requests.
	 *
	 * @param {Object} ctx - A dispatcher request context.
	 * @access private
	 */
	onCall(ctx) {
		const filter = this.getTopic(ctx);
		const node = this.get(filter);

		if (!node) {
			throw new DispatcherError(codes.NOT_FOUND);
		}

		ctx.response = node;
	}

	/**
	 * Initializes the Windows watch for the filter.
	 *
	 * @param {Object} params - Various parameters.
	 * @param {Function} params.publish - A function used to publish data to a dispatcher client.
	 * @access private
	 */
	initSubscription({ ctx, publish }) {
		const filter = ctx.request.params.filter && ctx.request.params.filter.replace(/^\//, '').split('/') || undefined;
		console.log('Starting Windows gawk watch: %s', filter || 'no filter');
		gawk.watch(this.results, filter && filter.split('.'), publish);
	}

	/**
	 * Handles a new subscriber.
	 *
	 * @param {Object} params - Various parameters.
	 * @param {Function} params.publish - A function used to publish data to a dispatcher client.
	 * @access private
	 */
	onSubscribe({ ctx, publish }) {
		const filter = ctx.request.params.filter && ctx.request.params.filter.replace(/^\//, '').split('/') || undefined;
		publish(this.get(filter));
	}

	/**
	 * Stops watching the Windows updates.
	 *
	 * @param {Object} params - Various parameters.
	 * @param {Function} params.publish - The function used to publish data to a dispatcher client.
	 * This is the same publish function as the one passed to `onSubscribe()`.
	 * @access private
	 */
	destroySubscription({ publish }) {
		console.log('Removing Windows gawk watch');
		gawk.unwatch(this.results, publish);
	}

	/**
	 * Returns the complete or filtered status values.
	 *
	 * @param {Array.<String>} [filter] - An array of namespaces used to filter and return a deep
	 * object.
	 * @return {*}
	 * @access private
	 */
	get(filter) {
		if (filter && !Array.isArray(filter)) {
			throw new TypeError('Expected filter to be an array');
		}

		let obj = this.results;

		if (filter) {
			for (let i = 0, len = filter.length; obj && typeof obj === 'object' && i < len; i++) {
				if (!obj.hasOwnProperty(filter[i])) {
					return null;
				}
				obj = obj[filter[i]];
			}
		}

		return obj;
	}
}
