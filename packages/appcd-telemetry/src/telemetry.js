/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import fs from 'fs-extra';
import path from 'path';
import pluralize from 'pluralize';
// import request from 'request';
import snooplogg, { styles } from 'snooplogg';
import uuid from 'uuid';

import { expandPath } from 'appcd-path';
// import { HookEmitter } from 'hook-emitter';
import { isFile } from 'appcd-fs';
import { randomBytes } from 'appcd-util';

const logger = snooplogg.config({ theme: 'detailed' })('appcd:telemetry');

export default class Telemetry /*extends HookEmitter*/ {
	/**
	 * Constructs an analytics instance.
	 *
	 * @param {Server} server - A server instance.
	 */
	constructor(server) {
		// super();

		/**
		 * The session id.
		 * @type {String}
		 */
		this.sessionId = uuid.v4();

		/**
		 * An internal sequence id that is appended to each event filename.
		 * @type {Number}
		 */
		this.seqId = 0;

		this.server = server;

		// listen for analytics events to store
		this.on('event', this.storeEvent.bind(this));
	}

	/**
	 * Initializes the analytics system.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	init() {
		// no need to initialize more than once
		if (this._initialized) {
			logger.warn('Analytics system already initialized');
			return Promise.resolve();
		}
		this._initialized = true;

		// create required directories
		this.eventsDir = expandPath(this.server.config('analytics.eventsDir'));
		fs.mkdirsSync(this.eventsDir);

		this._sendingEvents = false;

		// wire up the server start/stop with the send events loop
		this.server.on('appcd:start', () => {
			const sendLoop = () => {
				this.sendEvents()
					.catch(err => {
						// we've already displayed the error, so just fall
						// through and schedule the send loop again
					})
					.then(() => {
						if (this._sendingEvents) {
							this.sendTimer = setTimeout(
								sendLoop,
								Math.max(~~this.server.config('analytics.sendInterval', 60000), 1000)
							);
						}
					});
			};
			logger.info('Starting analytics send loop');
			this._sendingEvents = true;
			sendLoop();
		});

		this.server.on('appcd:shutdown', () => {
			clearTimeout(this.sendTimer);
			logger.info('Analytics send loop stopped');
			this._sendingEvents = false;
		});

		this.logger.info('Analytics system is ' + this.logger.highlight(this.server.config('analytics.enabled', true) ? 'enabled' : 'disabled'));
	}

	/**
	 * Writes an analytics event to disk.
	 *
	 * @param {Object} data - A data payload containing the analytics data.
	 * @return {Promise}
	 * @access private
	 */
	storeEvent(data) {
		const guid = this.server.config('appcd.guid');

		if (!this._initialized) {
			throw new Error('Analytics system not initialized');
		}

		if (!this.server.config('analytics.enabled', true) || typeof data !== 'object' || data === null || Array.isArray(data) || !data.type || typeof guid !== 'string' || !guid) {
			return;
		}

		// generate a 24-byte unique id
		const id = (Date.now().toString(16) + randomBytes(8)).slice(0, 24);

		const event = {
			type: data.type,
			id,
			aguid: guid,
			data,
			ts: new Date().toISOString()
		};

		// override with required data properties
		data.mid = this.server.config('appcd.machineId');
		data.sid = this.sessionId;
		data.userAgent = this.server.config('analytics.userAgent');

		// don't need 'type' anymore
		delete data.type;

		return this.hook('analytics:store', (filename, event) => new Promise((resolve, reject) => {
			fs.writeFile(filename, JSON.stringify(event), err => err ? reject(err) : resolve());
		}))(path.join(this.eventsDir, id + '.json'), event);
	}

	/**
	 * Sends all pending events.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	sendEvents() {
		return new Promise((resolve, reject) => {
			const jsonRegExp = /\.json$/;
			const batchSize  = Math.max(~~this.server.config('analytics.sendBatchSize', 10), 0);
			const url        = this.server.config('analytics.url');

			if (typeof url !== 'string' || !url) {
				return resolve();
			}

			let files = [];
			for (const name of fs.readdirSync(this.eventsDir)) {
				if (jsonRegExp.test(name)) {
					files.push(path.join(this.eventsDir, name));
				}
			}

			if (!files.length) {
				this.logger.debug('No pending analytics events');
				return resolve();
			}

			const sendHook = this.hook('analytics:send', (batch, params) => new Promise((resolve, reject) => {
				this.logger.debug(`Sending ${batch.length} analytics ${pluralize('event', batch.length)}`);

				params.json = batch.map(file => JSON.parse(fs.readFileSync(file)));

				request(params, (err, resp, body) => {
					if (err) {
						this.logger.error(`Error sending ${batch.length} analytics ${pluralize('event', batch.length)} (status ${resp.statusCode}):`);
						this.logger.error(err);
						reject(err);
						return;
					}

					logger.debug(`Sent ${batch.length} analytics ${pluralize('event', batch.length)} successfully (status ${resp.statusCode})`);
					for (const file of batch) {
						if (isFile(file)) {
							fs.unlinkSync(file);
						}
					}
					resolve();
				});
			}));

			const sendBatch = () => {
				let batch;
				if (batchSize > 0) {
					batch = files.splice(0, batchSize);
				} else {
					batch = files;
					files = [];
				}

				if (!batch.length) {
					return resolve();
				}

				Promise.resolve()
					.then(() => sendHook(batch, {
						method:    'POST',
						proxy:     this.server.config('network.proxy'),
						strictSSL: this.server.config('network.strictSSL', true),
						timeout:   Math.max(~~this.server.config('analytics.sendTimeout', 30000), 0),
						url
					}))
					.then(() => setImmediate(sendBatch))
					.catch(reject);
			};

			// kick off the sending
			sendBatch();
		});
	}
}
