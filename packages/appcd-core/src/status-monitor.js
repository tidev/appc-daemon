import Agent from 'appcd-agent';
import gawk from 'gawk';
import os from 'os';
import Response, { codes } from 'appcd-response';
import appcdLogger from './logger';

import { DataServiceDispatcher, DispatcherError } from 'appcd-dispatcher';

const logger = appcdLogger('appcd:core:status');
const { alert, note, ok } = appcdLogger.styles;
const { arrowUp, arrowDown } = appcdLogger.symbols;
const { filesize } = appcdLogger.humanize;

/**
 * Monitors the Appc Daemon status.
 */
export default class StatusMonitor extends DataServiceDispatcher {
	/**
	 * Initalizes the status and kicks off the timers to refresh the dynamic
	 * status information.
	 *
	 * @param {Config} cfg - The Appc Daemon config object.
	 * @access public
	 */
	constructor(cfg) {
		super();

		/**
		 * The user and system time this process has used.
		 * @type {Object}
		 */
		this.initCpu = this.currentCpu = process.cpuUsage();

		/**
		 * The high resolution timer for the amount of time this process has run.
		 * @type {Array.<Number>}
		 */
		this.initHrtime = this.currentHrTime = process.hrtime();

		/**
		 * The daemon status wrapped in a gawk object.
		 * @type {Object}
		 */
		this.data = gawk({
			pid:          process.pid,
			memory:       undefined,
			startupTime:  null,
			uptime:       process.uptime(),

			process: {
				execPath: process.execPath,
				execArgv: process.execArgv,
				argv:     process.argv,
				env:      process.env,
			},

			node: {
				version:  process.version.replace(/^v/, ''),
				versions: process.versions
			},

			system: {
				platform: process.platform,
				arch:     process.arch,
				cpus:     os.cpus().length,
				loadavg:  undefined,
				memory:   undefined
			}
		});

		/**
		 * The latest stats from the agent.
		 * @type {Object}
		 */
		this.stats = null;

		/**
		 * The Node.js process agent.
		 * @type {Agent}
		 */
		this.agent = new Agent({
			pollInterval: cfg.get('server.agentPollInterval')
		})
			.on('stats', stats => {
				this.stats = stats;

				gawk.mergeDeep(this.data, {
					memory: {
						heapTotal: stats.heapTotal,
						heapUsed:  stats.heapUsed,
						rss:       stats.rss
					},
					uptime: process.uptime(),
					system: {
						loadavg: os.loadavg(),
						memory: {
							free:  stats.freemem,
							total: os.totalmem()
						}
					}
				});
			})
			.on('error', () => {}); // suppress uncaught exceptions
	}

	/**
	 * Responds to "call" service requests.
	 *
	 * @param {Object} ctx - A dispatcher request context.
	 * @access private
	 */
	onCall(ctx) {
		if (ctx.data) {
			if (typeof data !== 'object') {
				throw new DispatcherError(codes.BAD_REQUEST);
			}
			this.merge(ctx.data);
			ctx.response = new Response(codes.OK);
		} else {
			super.onCall(ctx);
		}
	}

	/**
	 * Mixes an object into the status.
	 *
	 * @param {Object} obj - An object of values to merge into the status object.
	 * @returns {StatusMonitor}
	 * @access public
	 */
	merge(obj) {
		gawk.mergeDeep(this.data, obj);
		return this;
	}

	/**
	 * Starts monitoring the system.
	 *
	 * @returns {StatusMonitor}
	 * @access public
	 */
	start() {
		clearTimeout(this.logTimer);
		this.logTimer = setInterval(this.log.bind(this), 2000);
		this.agent.start();
		return this;
	}

	/**
	 * Stops the monitoring timers.
	 *
	 * @returns {StatusMonitor}
	 * @access public
	 */
	shutdown() {
		clearTimeout(this.logTimer);
		this.agent.stop();
		return this;
	}

	/**
	 * Logs the current CPU, memory, and uptime.
	 *
	 * @access private
	 */
	log() {
		if (!this.stats) {
			return;
		}

		const { cpu } = this.stats;
		const currentCPUUsage = cpu.toFixed(1);

		let cpuUsage = '';
		if (currentCPUUsage && this.prevCPUUsage) {
			if (currentCPUUsage < this.prevCPUUsage) {
				cpuUsage = ok((arrowDown + currentCPUUsage + '%').padStart(7));
			} else if (currentCPUUsage > this.prevCPUUsage) {
				cpuUsage = alert((arrowUp + currentCPUUsage + '%').padStart(7));
			}
		}
		if (!cpuUsage) {
			cpuUsage = note((' ' + (currentCPUUsage ? currentCPUUsage : '?') + '%').padStart(7));
		}
		this.prevCPUUsage = currentCPUUsage;

		const currentMemoryUsage = this.data.memory;
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

		// need to clone the object so we don't reference the object that gets updated
		this.prevMemory = { ...currentMemoryUsage };

		logger.log(
			`CPU: ${cpuUsage}  `
			+ `Heap:${heapUsage}  ` // purposely don't put a space after the ':', heapUsage is already left padded
			+ `RSS: ${rssUsage}  `
			+ `Uptime: ${note(`${(this.data.uptime / 60).toFixed(2)}m`)}`
		);
	}
}
