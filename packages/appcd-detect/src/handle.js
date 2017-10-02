import { EventEmitter } from 'events';

/**
 * A class that tracks active watchers' unwatch functions. This class is
 * intended to be returned from a `watch()` function.
 *
 * @emits {results} Emits the detection results.
 * @emits {ready} Emitted after the first scan has completed.
 * @emits {error} Emitted when an error occurs.
 */
export default class Handle extends EventEmitter {
	/**
	 * Initializes the Watcher instance.
	 * @access public
	 */
	constructor() {
		super();
		this.unwatchers = new Map();
	}

	/**
	 * Stops all active watchers.
	 *
	 * @returns {Handle}
	 * @access public
	 */
	async stop() {
		for (const unwatch of this.unwatchers.values()) {
			if (typeof unwatch === 'function') {
				await unwatch();
			}
		}
		this.unwatchers.clear();
		return this;
	}
}
