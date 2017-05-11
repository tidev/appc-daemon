import Collection from './collection';
import os from 'os';

import { EventEmitter } from 'events';

/**
 * Monitors the current process for CPU and memory usage.
 */
export default class Agent extends EventEmitter {
	/**
	 * Creates the Agent instance.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {Number} [opts.pollInterval=1000] - The number of milliseconds to poll the metrics.
	 * @access public
	 */
	constructor(opts = {}) {
		if (!opts || typeof opts !== 'object') {
			throw new TypeError('Expected options to be an object');
		}

		super();

		/**
		 * The number of milliseconds to wait before polling.
		 * @type {Number}
		 */
		this.pollInterval = Math.max(~~opts.pollInterval || 1000, 1);

		/**
		 * A map of names to collections.
		 * @type {Object}
		 */
		this.buckets = {};

		/**
		 * A list of functions to call when polling for stats.
		 * @type {Array}
		 */
		this.collectors = [];
	}

	/**
	 * Fetches the stats for the given bucket name.
	 *
	 * @param {String} name - The bucket name.
	 * @returns {Object}
	 * @access public
	 */
	getStats(name) {
		return this.buckets[name] ? this.buckets[name].stats : null;
	}

	/**
	 * Starts monitoring the system.
	 *
	 * @returns {Agent}
	 * @access public
	 */
	start() {
		this.initCpu = this.currentCpu = process.cpuUsage();
		this.initHrtime = this.currentHrTime = process.hrtime();

		this.poll();

		clearTimeout(this.pollTimer);
		this.pollTimer = setInterval(this.poll.bind(this), this.pollInterval);

		return this;
	}

	/**
	 * Stops monitoring the system.
	 *
	 * @returns {Agent}
	 * @access public
	 */
	stop() {
		clearTimeout(this.pollTimer);
		return this;
	}

	/**
	 * Adds a new collector.
	 *
	 * @returns {Agent}
	 * @access public
	 */
	addCollector(fn) {
		if (!fn || typeof fn !== 'function') {
			throw new TypeError('Expected collector to be a function');
		}
		this.collectors.push(fn);
		return this;
	}

	/**
	 * Removes a collector.
	 *
	 * @returns {Agent}
	 * @access public
	 */
	removeCollector(fn) {
		if (!fn || typeof fn !== 'function') {
			throw new TypeError('Expected collector to be a function');
		}

		for (let i = 0; i < this.collectors.length; i++) {
			if (this.collectors[i] === fn) {
				this.collectors.splice(i--, 1);
			}
		}

		return this;
	}

	/**
	 * Polls the CPU and memory.
	 *
	 * @access private
	 */
	poll() {
		const cpu    = process.cpuUsage(this.initCpu);
		const hrtime = process.hrtime(this.initHrtime);
		const mem    = process.memoryUsage();
		const stats = {
			cpu:       (cpu.user + cpu.system) / (hrtime[0] * 1000000 + hrtime[1] / 1000) * 100,
			freemem:   os.freemem(),
			heapTotal: mem.heapTotal,
			heapUsed:  mem.heapUsed,
			rss:       mem.rss
		};

		Promise
			.all(this.collectors.map(fn => Promise.resolve()
				.then(() => fn())
				.then(result => {
					if (result && typeof result === 'object') {
						Object.assign(stats, result);
					}
				})
			))
			.then(() => {
				// make sure we have collections for all the data we want to store
				for (const name of Object.keys(stats)) {
					if (!this.buckets[name]) {
						this.buckets[name] = new Collection(60 * 15); // 15 minutes worth of data
					}
				}

				// add the values for each stat to its bucket, or set zero if we don't have a value
				// for this poll
				for (const name of Object.keys(this.buckets)) {
					this.buckets[name].add(stats[name] || 0);
				}

				// add in the timestamp
				stats.ts = process.uptime();

				// emit the stats!
				this.emit('stats', stats);
			})
			.catch(err => this.emit('error', err));
	}
}
