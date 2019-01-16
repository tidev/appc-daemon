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
		return this.buckets[name] ? this.buckets[name].collection.stats : null;
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

		clearTimeout(this.pollTimer);
		this.poll();

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
	 * @param {Function} fn - The collector callback to add.
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
	 * @param {Function} fn - The collector callback to remove.
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
	 * @returns {Promise}
	 * @access private
	 */
	async poll() {
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

		try {
			await Promise.all(this.collectors.map(async fn => {
				const result = await fn();
				if (result && typeof result === 'object') {
					Object.assign(stats, result);
				}
			}));

			// figure out how long it's been since we started the last poll
			const now = Date.now();
			const delta = this.lastTimestamp ? (now - this.lastTimestamp) : 0;
			this.lastTimestamp = now;

			// schedule the next poll
			const next = this.pollInterval - (delta % this.pollInterval);
			this.pollTimer = setTimeout(this.poll.bind(this), next);

			// figure out how many intervals we missed, we'll interpolate the values later
			const missed = Math.floor((delta - this.pollInterval) / this.pollInterval) + 1;

			// make sure we have collections for all the data we want to store
			for (const name of Object.keys(stats)) {
				if (!this.buckets[name]) {
					this.buckets[name] = {
						collection: new Collection(60 * 15), // 15 minutes worth of data
						last:       null
					};
				}
			}

			// add the values for each stat to its bucket, or set zero if we don't have a value
			// for this poll
			for (const name of Object.keys(this.buckets)) {
				if (stats.hasOwnProperty(name)) {
					const value = stats[name];
					const bucket = this.buckets[name];
					let last = bucket.last || 0;

					// if we missed any intervals, interpolate the values
					// note that we don't emit stats for missed intervals
					for (let i = 1; i < missed; i++) {
						bucket.collection.add((value - last) * i / missed + last);
					}

					// add the value and set it as the last value
					bucket.collection.add(value);
					bucket.last = value;
				} else {
					// the bucket didn't receive a value so that probably means the collector
					// was removed or the bucket is no longer monitored, so remove the bucket
					delete this.buckets[name];
				}
			}

			// add in the timestamp
			stats.ts = process.uptime();

			// emit the stats!
			this.emit('stats', stats);
		} catch (err) {
			this.emit('error', err);
		}
	}

	/**
	 * Generates a snapshot of the collected data.
	 *
	 * @returns {Object}
	 * @access public
	 */
	health() {
		const result = {};
		for (const [ name, bucket ] of Object.entries(this.buckets)) {
			result[name] = bucket.collection.stats;
		}
		return result;
	}
}
