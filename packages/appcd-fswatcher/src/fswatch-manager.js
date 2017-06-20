import path from 'path';
import snooplogg from 'snooplogg';

import { codes } from 'appcd-response';
import Dispatcher, { DispatcherError, ServiceDispatcher } from 'appcd-dispatcher';
import { EventEmitter } from 'events';
import { expandPath } from 'appcd-path';
import { FSWatcher, renderTree, rootEmitter, status, tree } from './fswatcher';

const logger = snooplogg.config({ theme: 'detailed' })('appcd:fswatcher:manager');
const { highlight, note } = snooplogg.styles;

/**
 * Starts and stops file system watches and sends notifications when a fs event occurs.
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

		rootEmitter
			.on('change', evt => this.emit('change', evt))
			.on('stats', stats => {
				this.emit('stats', stats);
				Dispatcher
					.call('/appcd/status', { data: { fs: stats } })
					.catch(err => {
						logger.warn('Failed to update status');
						logger.warn(err);
					});
			});

		/**
		 * A map of paths to `FSWatcher` instances.
		 * @type {Object}
		 */
		this.watchers = {};
	}

	/**
	 * Determines the topic for the incoming request.
	 *
	 * @param {DispatcherContext} ctx - The dispatcher request context object.
	 * @returns {String}
	 * @access private
	 */
	getTopic(ctx) {
		const { topic, data } = ctx.request;
		return topic || (data && data.path && expandPath(data.path));
	}

	/**
	 * Responds to "subscribe" service requests.
	 *
	 * @param {Object} ctx - A dispatcher request context.
	 * @param {Function} publish - A function used to publish data to a dispatcher client.
	 * @access private
	 */
	onSubscribe(ctx, publish) {
		const path = this.getTopic(ctx);

		if (!path) {
			throw new DispatcherError(codes.MISSING_ARGUMENT, 'Missing required parameter "%s"', 'path');
		}

		logger.log('Starting FSWatcher: %s', highlight(path));
		const { data } = ctx.request;
		this.watchers[path] = new FSWatcher(path, { recursive: data && !!data.recursive })
			.on('change', publish);
		logger.log(renderTree());
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
		const path = this.getTopic(ctx);
		const watcher = path && this.watchers[path];
		if (watcher) {
			logger.log('Stopping FSWatcher: %s', highlight(path));
			watcher.close();
			delete this.watchers[path];
			logger.log(renderTree());
		}
	}

	/**
	 * Stops all active file system watchers.
	 */
	shutdown() {
		for (const path of Object.keys(this.watchers)) {
			this.watchers[path].close();
			delete this.watchers[path];
		}
	}

	/**
	 * Returns the FSWatcher internal statistics.
	 *
	 * @returns @Object
	 * @access public
	 */
	status() {
		return status();
	}

	/**
	 * Returns a rendered string of the current state of the fs watcher tree.
	 *
	 * @returns {String}
	 * @access public
	 */
	get tree() {
		return tree;
	}
}
