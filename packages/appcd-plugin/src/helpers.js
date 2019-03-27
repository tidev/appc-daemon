/* eslint-disable promise/no-callback-in-promise, promise/always-return */

import Dispatcher from 'appcd-dispatcher';

import { debounce as debouncer } from 'appcd-util';

/**
 * A map of types to subscription ids.
 *
 * @type {Object}
 */
const subscriptions = {};

/**
 * Subscribes to filesystem events for the specified paths.
 *
 * @param {Object} params - Various parameters.
 * @param {Boolean} [params.debounce=false] - When `true`, wraps the `handler` with a debouncer.
 * @param {Number} [params.depth] - The max depth to recursively watch.
 * @param {Function} params.handler - A callback function to fire when a fs event occurs.
 * @param {Array.<String>} params.paths - One or more paths to watch.
 * @param {String} params.type - The type of subscription.
 * @returns {Promise<Object>} Resolves a map of paths to sids.
 */
export async function watch({ debounce, depth, handler, paths, type }) {
	const callback = debounce ? debouncer(handler) : handler;
	const sidsByPath = Object.assign({}, subscriptions[type]);
	const results = {};

	await paths.reduce((promise, path) => promise.then(async () => {
		delete sidsByPath[path];

		if (subscriptions[type] && subscriptions[type][path]) {
			// already watching this path
			results[path] = subscriptions[type][path];
			return;
		}

		const data = { path };

		if (depth) {
			data.recursive = true;
			data.depth = depth;
		}

		const { response } = await Dispatcher.call('/appcd/fswatch', {
			data,
			type: 'subscribe'
		});

		let sid;

		response.on('end', () => {
			if (sid && subscriptions[type]) {
				for (const path of Object.keys(subscriptions[type])) {
					if (sid === subscriptions[type][path]) {
						delete subscriptions[type][path];
						break;
					}
				}
			}
		});

		sid = results[path] = await new Promise(resolve => {
			response.on('data', async data => {
				if (data.type === 'subscribe') {
					if (!subscriptions[type]) {
						subscriptions[type] = {};
					}
					subscriptions[type][data.path] = data.sid;
					resolve(data.sid);
				} else if (data.type === 'event') {
					callback(data.message);
				}
			});
		});
	}), Promise.resolve());

	const sids = Object.values(sidsByPath);
	if (sids.length) {
		await unwatch(type, sids);
	}

	return results;
}

/**
 * Unsubscribes a list of filesystem watcher subscription ids.
 *
 * @param {Number} type - The type of subscription.
 * @param {Array.<String>} [sids] - An array of subscription ids to unsubscribe. If not
 * specified, defaults to all sids for the specified types.
 * @returns {Promise}
 */
export async function unwatch(type, sids) {
	if (!subscriptions[type]) {
		return;
	}

	if (sids) {
		const sidToPath = {};
		for (const [ path, sid ] of Object.entries(subscriptions[type])) {
			sidToPath[sid] = path;
		}

		for (const sid of sids) {
			await Dispatcher.call('/appcd/fswatch', {
				sid,
				type: 'unsubscribe'
			});

			const path = sidToPath[sid];
			if (path) {
				delete subscriptions[type][path];
			}
		}

		if (!Object.keys(subscriptions[type]).length) {
			delete subscriptions[type];
		}
	} else {
		for (const sid of Object.values(subscriptions[type])) {
			await Dispatcher.call('/appcd/fswatch', {
				sid,
				type: 'unsubscribe'
			});
		}
		delete subscriptions[type];
	}
}
