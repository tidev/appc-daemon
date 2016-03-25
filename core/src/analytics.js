import autobind from 'autobind-decorator';
import crypto from 'crypto';
import { existsSync, expandPath } from './util';
import fs from 'fs';
import { HookEmitter } from 'hook-emitter';
import Logger from './logger';
import macaddress from 'macaddress';
import mkdirp from 'mkdirp';
import path from 'path';
import pluralize from 'pluralize';
import request from 'request';
import uuid from 'node-uuid';

export default class Analytics extends HookEmitter {
	/**
	 * The machine id to be loaded from the `.mid` file or from the mac address.
	 * @type {String}
	 */
	machineId = null;

	/**
	 * The session id.
	 * @type {String}
	 */
	sessionId = uuid.v4();

	/**
	 * An internal sequence id that is appended to each event filename.
	 * @type {Number}
	 */
	seqId = 0;

	/**
	 * Constructs an analytics instance.
	 *
	 * @param {Server} server - A server instance.
	 */
	constructor(server) {
		super();

		this.server = server;

		this.logger = new Logger('appcd:analytics');

		// listen for analytics events to store
		this.on('event', this.storeEvent);
	}

	/**
	 * Initializes the analytics system.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	@autobind
	initialize() {
		// no need to initialize more than once
		if (this._initialized) {
			this.logger.warn('Analytics system already initialized');
			return Promise.resolve();
		}
		this._initialized = true;

		// create required directories
		this.eventsDir = expandPath(this.server.config('analytics.eventsDir'));
		mkdirp.sync(this.eventsDir);

		this._sendingEvents = false;

		// wire up the server start/stop with the send events loop
		this.server.on('appcd:start', () => {
			const sendLoop = () => {
				this.sendEvents()
					.then(() => {
						if (this._sendingEvents) {
							this.sendTimer = setTimeout(sendLoop, Math.max(~~this.server.config('analytics.sendInterval', 60000), 1000));
						}
					});
			};
			this.logger.info('Starting analytics send loop');
			this._sendingEvents = true;
			sendLoop();
		});

		this.server.on('appcd:shutdown', () => {
			clearTimeout(this.sendTimer);
			this.logger.info('Analytics send loop stopped');
			this._sendingEvents = false;
		});

		this.logger.info('Analytics system is ' + this.logger.highlight(this.server.config('analytics.enabled', true) ? 'enabled' : 'disabled'));

		return new Promise((resolve, reject) => {
			const appcdHome = expandPath(this.server.config('appcd.home'));
			const midFile = path.join(appcdHome, '.mid');

			// load the machine id, if exists
			this.machineId = null;
			if (existsSync(midFile)) {
				this.machineId = fs.readFileSync(midFile).toString().split('\n')[0];
			}

			if (this.machineId && this.machineId.length === 32) {
				return resolve();
			}

			// try to get a mac address
			macaddress.one((err, mac) => {
				if (err || !mac) {
					this.machineId = crypto.randomBytes(16).toString('hex');
				} else {
					this.machineId = crypto.createHash('md5').update(mac).digest('hex');
				}

				// save the mid to file
				mkdirp.sync(appcdHome);
				fs.writeFile(midFile, this.machineId, err => err ? reject(err) : resolve());
			});
		});
	}

	/**
	 * Writes an analytics event to disk.
	 *
	 * @param {Object} data - A data payload containing the analytics data.
	 * @return {Promise}
	 * @access private
	 */
	@autobind
	storeEvent(data) {
		const guid = this.server.config('appcd.guid');

		if (!this._initialized) {
			throw new Error('Analytics system not initialized');
		}

		if (!this.server.config('analytics.enabled', true) || typeof data !== 'object' || data === null || Array.isArray(data) || !data.type || typeof guid !== 'string' || !guid) {
			return;
		}

		// generate a 24-byte unique id
		const id = (Date.now().toString(16) + crypto.randomBytes(8).toString('hex')).slice(0, 24);

		const event = {
			type: data.type,
			id,
			aguid: guid,
			data,
			ts: new Date().toISOString()
		};

		// override with required data properties
		data.mid = this.machineId;
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
	@autobind
	sendEvents() {
		return new Promise((resolve, reject) => {
			const jsonRegExp = /\.json$/;
			const batchSize  = Math.max(~~this.server.config('analytics.sendBatchSize', 10), 0);
			const url        = this.server.config('analytics.url');

			if (typeof url !== 'string' || !url) {
				return resolve();
			}

			let files = [];
			for (let name of fs.readdirSync(this.eventsDir)) {
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
					if (!err && Array.isArray(body)) {
						this.logger.debug(`Sent ${batch.length} analytics ${pluralize('event', batch.length)} successfully`);
						body.forEach((status, i) => {
							if (status === 204 && existsSync(batch[i])) {
								fs.unlinkSync(batch[i]);
							}
						});
						setImmediate(sendBatch);
						resolve();
					} else {
						this.logger.error(`Error sending ${batch.length} analytics ${pluralize('event', batch.length)}:`);
						this.logger.error(err);
						reject(err);
					}
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

				sendHook(batch, {
					method:    'POST',
					proxy:     this.server.config('network.proxy'),
					strictSSL: this.server.config('network.strictSSL', true),
					timeout:   Math.max(~~this.server.config('analytics.sendTimeout', 30000), 0),
					url
				});
			};

			// kick off the sending
			sendBatch();
		});
	}
}
