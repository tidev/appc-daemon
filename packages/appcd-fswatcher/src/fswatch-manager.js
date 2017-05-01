import { DispatcherError, ServiceDispatcher } from 'appcd-dispatcher';
import FSWatcher, { rootEmitter } from './fswatcher';
import snooplogg from 'snooplogg';

import { codes } from 'appcd-response';
import { EventEmitter } from 'events';

const logger = snooplogg.config({ theme: 'detailed' })('appcd:subprocess:manager');
const { highlight, note } = snooplogg.styles;

/**
 * Starts and stops filesystem watches and sends notifications when a fs event occurs.
 */
export default class FSWatchManager extends EventEmitter {
	/**
	 * Creates the fs watch manager dispatcher and initializes it as a service dispatcher.
	 *
	 * @access public
	 */
	constructor() {
		super();
		this.dispatcher = new ServiceDispatcher(this);
		rootEmitter.on('change', evt => this.emit('change', evt));
	}

	/**
	 * Responds to "subscribe" service requests.
	 *
	 * @param {Object} ctx - A dispatcher request context.
	 * @param {Function} publish - A function used to publish data to a dispatcher client.
	 * @access private
	 */
	onSubscribe(ctx, publish) {
		if (!ctx.data.path) {
			throw new DispatcherError(codes.MISSING_ARGUMENT, 'Missing required parameter "%s"', 'path');
		}
		ctx.watcher = new FSWatcher(ctx.data.path, { recursive: !!ctx.data.recursive })
			.on('change', publish);
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
		if (ctx.watcher) {
			ctx.watcher.close();
			ctx.watcher = null;
		}
	}
}
