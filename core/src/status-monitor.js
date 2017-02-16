import gawk from 'gawk';
import os from 'os';
import snooplogg from './logger';

const logger = snooplogg('appcd:status');
const { alert, highlight, note, ok } = snooplogg.styles;
const { arrowUp, arrowDown } = snooplogg.symbols;
const { filesize } = snooplogg.humanize;

/**
 * Monitors the Appc Daemon status.
 */
export default class StatusMonitor {
	/**
	 * Initalizes the status and kicks off the timers to refresh the dynamic
	 * status information.
	 */
	constructor() {
		this.initCpu    = process.cpuUsage();
		this.initHrtime = process.hrtime();

		this.status = gawk({
			appcd: {
				pid:      process.pid,
				execPath: process.execPath,
				execArgv: process.execArgv,
				argv:     process.argv,
				env:      process.env,
				cpu:      this.initCpu,
				hrtime:   this.initHrtime,
				memory:   undefined,
				uptime:   undefined
			},
			node: {
				version:  process.version.replace(/^v/, ''),
				versions: process.versions
			},
			system: {
				platform: process.platform,
				arch:     process.arch,
				cpus:     os.cpus().length,
				hostname: os.hostname(),
				loadavg:  undefined,
				memory:   undefined
			}
		});

		this.refresh();
		this.log();
	}

	/**
	 * Returns the complete or filtered status values.
	 *
	 * Important! This function returns an internal reference and it's critical
	 * that the result is not modified. If you need to modify the status result,
	 * then clone it first.
	 *
	 * @param {Array.<String>} [filter] - An array of namespaces used to filter
	 * and return a deep object.
	 * @return {*}
	 * @access public
	 */
	get(filter) {
		if (filter && !Array.isArray(filter)) {
			throw new TypeError('Expected filter to be an array');
		}

		let obj = this.status;

		if (!filter) {
			return obj;
		}

		for (let i = 0, len = filter.length; obj && typeof obj === 'object' && i < len; i++) {
			if (obj.hasOwnProperty(filter[i])) {
				obj = obj[filter[i]];
			}
		}

		return obj;
	}

	/**
	 * Starts monitoring the system.
	 *
	 * @returns {StatusMonitor}
	 * @access public
	 */
	start() {
		this.stop();
		this.logTimer     = setInterval(this.log.bind(this), 2000);
		this.refreshTimer = setInterval(this.refresh.bind(this), 1000);
		return this;
	}

	/**
	 * Stops the monitoring timers.
	 *
	 * @returns {StatusMonitor}
	 * @access public
	 */
	stop() {
		clearTimeout(this.logTimer);
		clearTimeout(this.refreshTimer);
		return this;
	}

	/**
	 * Logs the current CPU, memory, and uptime.
	 *
	 * @access private
	 */
	log() {
		const { cpu, hrtime } = this.status.appcd;
		const currentCPUUsage = ((cpu.user + cpu.system) / (hrtime[0] * 1000000 + hrtime[1] / 1000) * 100).toFixed(1);

		let cpuUsage = '';
		if (currentCPUUsage && this.prevCPUUsage) {
			if (currentCPUUsage < this.prevCPUUsage) {
				cpuUsage = ok((arrowDown + currentCPUUsage + '%').padStart(7));
			} else if (currentCPUUsage > this.prevCPUUsage) {
				cpuUsage = alert((arrowUp + currentCPUUsage + '%').padStart(7));
			}
		}
		if (!cpuUsage) {
			cpuUsage = note((' ' + (currentCPUUsage ? currentCPUUsage : '?') + '%').padStart(6));
		}
		this.prevCPUUsage = currentCPUUsage;

		const currentMemoryUsage = this.status.appcd.memory;
		const heapUsed  = filesize(currentMemoryUsage.heapUsed).toUpperCase();
		const heapTotal = filesize(currentMemoryUsage.heapTotal).toUpperCase();
		const rss       = filesize(currentMemoryUsage.rss).toUpperCase();
		let heapUsage   = note(heapUsed.padStart(11)) + ' /' + note(heapTotal.padStart(11));
		let rssUsage    = note(rss.padStart(10));

		if (this.prevMemory) {
			if (currentMemoryUsage.heapUsed < this.prevMemory.heapUsed) {
				heapUsage = ok((arrowDown + heapUsed).padStart(11));
			} else if (currentMemoryUsage.heapUsed > this.prevMemory.heapUsed) {
				heapUsage = alert((arrowUp + heapUsed).padStart(11));
			} else {
				heapUsage = note(heapUsed.padStart(11));
			}

			heapUsage += ' /';

			if (currentMemoryUsage.heapTotal < this.prevMemory.heapTotal) {
				heapUsage += ok((arrowDown + heapTotal).padStart(11));
			} else if (currentMemoryUsage.heapTotal > this.prevMemory.heapTotal) {
				heapUsage += alert((arrowUp + heapTotal).padStart(11));
			} else {
				heapUsage += note(heapTotal.padStart(11));
			}

			if (currentMemoryUsage.rss < this.prevMemory.rss) {
				rssUsage = ok((arrowDown + rss).padStart(10));
			} else if (currentMemoryUsage.rss > this.prevMemory.rss) {
				rssUsage = alert((arrowUp + rss).padStart(10));
			}
		}

		this.prevMemory = currentMemoryUsage;

		logger.log(
			`CPU: ${cpuUsage}  ` +
			`Heap:${heapUsage}  ` + // purposely don't put a space after the ':', heapUsage is already left padded
			`RSS: ${rssUsage}  ` +
			`Uptime: ${highlight(this.status.appcd.uptime.toFixed(1) + 's')}`
		);
	}

	/**
	 * Refreshes dynamic status information.
	 *
	 * @access private
	 */
	refresh() {
		gawk.mergeDeep(this.status, {
			appcd: {
				cpu:    process.cpuUsage(this.initCpu),
				hrtime: process.hrtime(this.initHrtime),
				memory: process.memoryUsage(),
				uptime: process.uptime()
			},
			system: {
				loadavg: os.loadavg(),
				memory: {
					free:  os.freemem(),
					total: os.totalmem()
				}
			}
		});
	}
}
