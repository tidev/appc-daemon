import Dispatcher, { DispatcherError, ServiceDispatcher } from 'appcd-dispatcher';
import snooplogg from './logger';

const logger = snooplogg.config({ theme: 'detailed' })('appcd:subprocess:manager');
const { highlight, note } = snooplogg.styles;

/**
 * Starts and stops filesystem watches and sends notifications when a fs event occurs.
 */
export default class FSWatchManager {
	/**
	 * Creates the fs watch manager dispatcher and initializes it as a service dispatcher.
	 *
	 * @access public
	 */
	constructor() {
		this.dispatcher = new Dispatcher()
			.register(new ServiceDispatcher('/:filter*', this));
	}

	/**
	 * Responds to "subscribe" service requests.
	 *
	 * @param {Object} ctx - A dispatcher request context.
	 * @param {Function} publish - A function used to publish data to a dispatcher client.
	 * @access private
	 */
	onSubscribe(ctx, publish) {
		logger.log('onSubscribe');
	}

	/**
	 * Responds to "unsubscribe" service requests.
	 *
	 * @param {Object} ctx - A dispatcher request context.
	 * @param {Function} publish - The function used to publish data to a dispatcher client. This is
	 * the same publish function as the one passed to `onSubscribe()`.
	 * @access private
	 */
	onUnsubscribe(ctx, publish) {
		logger.log('onUnsubscribe');
	}
}
