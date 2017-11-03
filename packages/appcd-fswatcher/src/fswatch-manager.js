import appcdLogger from 'appcd-logger';
import Dispatcher, { DispatcherError, ServiceDispatcher } from 'appcd-dispatcher';

import { codes } from 'appcd-response';
import { EventEmitter } from 'events';
import { expandPath } from 'appcd-path';
import { FSWatcher, renderTree, rootEmitter, status as fsStatus, tree as fsTree } from './fswatcher';

const logger = appcdLogger('appcd:fswatcher:manager');
const { highlight } = appcdLogger.styles;

/**
 * Starts and stops file system watches and sends notifications when a fs event occurs.
 */
export default class FSWatchManager extends ServiceDispatcher {
	/**
	 * Creates the fs watch manager dispatcher and initializes it as a service dispatcher.
	 *
	 * @access public
	 */
	constructor() {
		super();

		this.emitter = new EventEmitter();
		this.on = this.emitter.on.bind(this.emitter);

		/**
		 * A map of paths to `FSWatcher` instances.
		 * @type {Object}
		 */
		this.watchers = {};

		rootEmitter
			.on('change', evt => this.emitter.emit('change', evt))
			.on('stats', stats => {
				this.emitter.emit('stats', stats);
				Dispatcher
					.call('/appcd/status', { data: { fs: stats } })
					.catch(err => {
						logger.warn('Failed to update status');
						logger.warn(err);
					});
			});
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
	 * @param {Object} params - Various parameters.
	 * @param {Object} params.ctx - A dispatcher request context.
	 * @param {String} params.sid - The subscription id.
	 * @param {String} params.topic - The path to watch.
	 * @param {Function} params.publish - A function used to publish data to a dispatcher client.
	 * @access private
	 */
	onSubscribe({ ctx, sid, topic: path, publish }) {
		if (!path) {
			throw new DispatcherError(codes.MISSING_ARGUMENT, 'Missing required parameter "%s"', 'path');
		}

		logger.log('Starting FSWatcher: %s', highlight(path));
		const { depth, recursive } = ctx.request.data || {};

		const watcher = new FSWatcher(path, { depth, recursive });
		watcher.on('change', publish);
		this.watchers[sid] = watcher;

		logger.log(renderTree());
	}

	/**
	 * Responds to "unsubscribe" service requests.
	 *
	 * @param {Object} params - Various parameters.
	 * @param {Object} params.ctx - A dispatcher request context.
	 * @param {String} params.sid - The subscription id.
	 * @param {Function} params.publish - The function used to publish data to a dispatcher client. This is
	 * the same publish function as the one passed to `onSubscribe()`.
	 * @access private
	 */
	onUnsubscribe({ sid }) {
		const watcher = sid && this.watchers[sid];
		if (watcher) {
			logger.log('Stopping FSWatcher: %s', highlight(sid));
			watcher.close();
			delete this.watchers[sid];
			logger.log(renderTree());
		}
	}

	/**
	 * Stops all active file system watchers.
	 *
	 * @access public
	 */
	shutdown() {
		for (const sid of Object.keys(this.watchers)) {
			this.watchers[sid].close();
			delete this.watchers[sid];
		}
	}

	/**
	 * Returns the FSWatcher internal statistics.
	 *
	 * @returns {Object}
	 * @access public
	 */
	status() {
		return fsStatus();
	}

	/**
	 * Returns a rendered string of the current state of the fs watcher tree.
	 *
	 * @returns {String}
	 * @access public
	 */
	get tree() {
		return fsTree;
	}
}
