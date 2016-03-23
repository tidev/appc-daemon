import autobind from 'autobind-decorator';
import { existsSync, expandPath } from './util';
import fs from 'fs';
import { HookEmitter } from 'hook-emitter';
import mkdirp from 'mkdirp';
import path from 'path';

export default class Analytics extends HookEmitter {
	/**
	 * Constructs an analytics instance.
	 *
	 * @param {Server} server - A server instance.
	 */
	constructor(server) {
		super();

		this.server = server;

		this.eventsDir     = server.config('analytics.eventsDir');
		this.url           = server.config('analytics.url');
		this.sendBatchSize = Math.max(~~server.config('analytics.sendBatchSize', 10), 1);

		if (!server.config('analytics.enabled', true) || typeof this.url !== 'string' || !this.url || typeof this.eventsDir !== 'string' || !this.eventsDir) {
			return;
		}

		// ensure the events directory exists
		this.eventsDir = expandPath(this.eventsDir);
		mkdirp.sync(this.eventsDir);

		// init the sequence id that is appended to each event filename
		this.seqId = 0;

		// listen for analytics events to store
		this.on('event', this.storeEvent.bind(this));

		// ensure that the flush interval is at least 1 second
		const sendInterval = Math.max(~~server.config('analytics.sendInterval', 15000), 1000);
		const sendLoop = () => {
			this.sendTimer = setTimeout(() => this.sendEvents().then(sendLoop), sendInterval);
		};
		sendLoop();

		server.on('shutdown', () => clearTimeout(this.sendTimer));
	}

	/**
	 * Writes an analytics event to disk.
	 *
	 * @param {Object} data - A data payload containing the analytics data.
	 * @return {Promise}
	 * @access private
	 */
	storeEvent(data) {
		if (!this.server.config('analytics.enabled', true) || typeof data !== 'object' || data === null || Array.isArray(data)) {
			return;
		}

		if (!data.type) {
			data.type = 'unknown';
		}

		return this.hook('store', data => new Promise((resolve, reject) => {
			appcd.logger.log('got analytics event!');
			appcd.logger.log(data);

			const filename = (new Date).toISOString().replace(/:/g, '-') + '_' + String(this.seqId++).padStart(6, '0') + '.json';
			fs.writeFile(path.join(this.eventsDir, filename), JSON.stringify(data), err => {
				if (err) {
					return reject(err);
				}
				return resolve();
			});
		}))(data);
	}

	/**
	 * Sends all pending events.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	sendEvents() {
		return new Promise((resolve, reject) => {
			fs.readdir(this.eventsDir, (err, files) => {
				if (err) {
					return reject(err);
				}

				const jsonRegExp = /\.json$/;
				const events = [];

				for (let name of files) {
					if (jsonRegExp.test(name)) {
						const file = path.join(this.eventsDir, name);
						events.push({
							file,
							data: JSON.parse(fs.readFileSync(file))
						});
						if (events.length >= this.sendBatchSize) {
							break;
						}
					}
				}

				this.hook('send', events => new Promise((resolve, reject) => {
					console.log(events);

					// network: {
					// 	proxyUrl: null,
					// 	rejectUnauthorized: true
					// fs.unlinkSync(file);

					resolve();
				}))(events).then(resolve, reject);
			});
		});
	}
}
