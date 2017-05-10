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

		this.pollInterval = opts.pollInterval || 1000;

		this.buckets = {};

		this.collectors = new Set;
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
		this.collectors.add(fn);
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
		this.collectors.delete(fn);
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
			cpu:       ((cpu.user + cpu.system) / (hrtime[0] * 1000000 + hrtime[1] / 1000) * 100).toFixed(1),
			freemem:   os.freemem(),
			heapTotal: mem.heapTotal,
			heapUsed:  mem.heapUsed,
			rss:       mem.rss
		};

		Process
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
				for (const key of Object.keys(stats)) {
					if (!this.buckets[key]) {
						this.buckets[key] = new Collection(60 * 15); // 15 minutes worth of data
					}
				}

				// add the values for each stat to its bucket, or set zero if we don't have a value
				// for this poll
				for (const key of Object.keys(this.buckets)) {
					this.buckets[key].add(stats[key] || 0);
				}

				// add in the timestamp
				stats.ts = process.uptime();

				// emit the stats!
				this.emit('stats', stats);
			});
	}
}
