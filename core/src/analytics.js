import autobind from 'autobind-decorator';
import crypto from 'crypto';
import { existsSync, expandPath } from './util';
import fs from 'fs';
import { HookEmitter } from 'hook-emitter';
import macaddress from 'macaddress';
import mkdirp from 'mkdirp';
import path from 'path';
import request from 'request';
import uuid from 'node-uuid';

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
		this.guid          = server.config('appcd.guid');
		this.url           = server.config('analytics.url');
		this.sendBatchSize = Math.max(~~server.config('analytics.sendBatchSize', 10), 1);

		if (!server.config('analytics.enabled', true)
			|| typeof this.guid !== 'string' || !this.guid
			|| typeof this.url !== 'string' || !this.url
			|| typeof this.eventsDir !== 'string' || !this.eventsDir) {
			return;
		}

		// ensure the events directory exists
		this.eventsDir = expandPath(this.eventsDir);

		// the machine id
		this.machineId = null;

		// create ourselves a session id
		this.sessionId = uuid.v4();

		// init the sequence id that is appended to each event filename
		this.seqId = 0;

		// listen for analytics events to store
		this.on('event', this.storeEvent.bind(this));

		// ensure that the flush interval is at least 1 second
		this.sendInterval = Math.max(~~server.config('analytics.sendInterval', 60000), 1000);
	}

	/**
	 * Initializes the analytics system.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	@autobind
	initialize() {
		return Promise
			.all([
				new Promise((resolve, reject) => {
					const appcdHome = expandPath(this.server.config('appcd.home'));
					const midFile = path.join(appcdHome, '.appcd.mid');
					if (existsSync(midFile)) {
						this.machineId = fs.readFileSync(midFile).toString().split('\n')[0];
					}

					if (this.machineId && this.machineId.length === 32) {
						return resolve();
					}

					macaddress.one((err, mac) => {
						if (err || !mac) {
							this.machineId = crypto.randomBytes(16).toString('hex');
						} else {
							this.machineId = crypto.createHash('md5').update(mac).digest('hex');
						}

						// save the mid to file
						mkdirp(appcdHome, err => {
							if (err) {
								return reject(err);
							}
							fs.writeFile(midFile, this.machineId, err => err ? reject(err) : resolve());
						});
					});
				}),
				new Promise((resolve, reject) => {
					mkdirp(this.eventsDir, err => {
						err ? reject(err) : resolve();
					});
				})
			])
			.then(() => {
				const sendLoop = () => {
					this.sendTimer = setTimeout(() => this.sendEvents().then(sendLoop), this.sendInterval);
				};
				sendLoop();
				this.server.on('shutdown', () => clearTimeout(this.sendTimer));
			});
	}

	/**
	 * Writes an analytics event to disk.
	 *
	 * @param {Object} data - A data payload containing the analytics data.
	 * @return {Promise}
	 * @access private
	 */
	storeEvent(data) {
		if (!this.server.config('analytics.enabled', true) || typeof data !== 'object' || data === null || Array.isArray(data) || !data.type) {
			return;
		}

		// generate a 24-byte unique id
		const id = (Date.now().toString(16) + crypto.randomBytes(8).toString('hex')).slice(0, 24);

		const event = {
			type: data.type,
			id,
			aguid: this.guid,
			data,
			ts: new Date().toISOString()
		};

		if (!data.mid) {
			data.mid = this.machineId;
		}

		if (!data.sid) {
			data.sid = this.sessionId;
		}

		if (!data.userAgent) {
			data.userAgent = this.server.config('analytics.userAgent');
		}

		// don't need 'type' anymore
		delete data.type;

		return this.hook('store', (filename, event) => new Promise((resolve, reject) => {
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
						if (this.sendBatchSize > 0 && events.length >= this.sendBatchSize) {
							break;
						}
					}
				}

				this.hook('send', events => new Promise((resolve, reject) => {
					console.log(events);

					// request()
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
