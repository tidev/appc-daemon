/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import appcdLogger from 'appcd-logger';
import Config from 'appcd-config';
import Dispatcher from 'appcd-dispatcher';
import fs from 'fs-extra';
import getMachineId from 'appcd-machine-id';
import path from 'path';
import request from 'appcd-request';
import Response, { AppcdError, codes, i18n } from 'appcd-response';
import uuid from 'uuid';

import { expandPath } from 'appcd-path';
import { isDir, isFile } from 'appcd-fs';

const { __n } = i18n();

const { error, log } = appcdLogger('appcd:telemetry');
const { highlight } = appcdLogger.styles;

const jsonRegExp = /\.json$/;

/**
 * Records and sends telemetry data.
 */
export default class Telemetry extends Dispatcher {
	/**
	 * Constructs an analytics instance.
	 *
	 * @param {Config} cfg - The initial config object.
	 * @access public
	 */
	constructor(cfg) {
		if (!cfg || !(cfg instanceof Config)) {
			throw new TypeError('Expected config to be a valid config object');
		}

		const aguid = cfg.get('telemetry.guid');
		if (!aguid || typeof aguid !== 'string') {
			throw new Error('Config is missing a required, valid "telemetry.guid"');
		}

		super();

		/**
		 * The Appc Daemon application guid.
		 * @type {String}
		 */
		this.aguid = aguid;

		/**
		 * The daemon config instance.
		 * @type {Config}
		 */
		this.config = {
			enabled:       false,
			eventsDir:     null,
			sendBatchSize: 10,
			sendInterval:  60000, // 1 minute
			sendTimeout:   60000, // 1 minute
			url:           null
		};

		/**
		 * The deploy type for the events.
		 * @type {String}
		 */
		this.deployType = cfg.get('telemetry.environment') || 'production';

		/**
		 * The time, in milliseconds, that the last send was fired.
		 * @type {Number}
		 */
		this.lastSend = null;

		/**
		 * The machine id. This value is used to also determine if the telemetry system has been
		 * initialized.
		 * @type {String}
		 */
		this.mid = null;

		/**
		 * A promise that is resolved when telemetry data is not being sent to the server.
		 * @type {Promise}
		 */
		this.pending = Promise.resolve();

		/**
		 * The timer for sending telemetry data.
		 * @type {Timer}
		 */
		this.sendTimer = null;

		/**
		 * An internal sequence id that is appended to each event filename.
		 * @type {Number}
		 */
		this.seqId = 1;

		/**
		 * The session id.
		 * @type {String}
		 */
		this.sessionId = uuid.v4();

		// set the config and wire up the watcher
		this.updateConfig(cfg.get('telemetry') || {});
		cfg.watch('telemetry', obj => this.updateConfig(obj));

		// wire up the telemetry route
		this.register('/', this.addEvent.bind(this));
	}

	/**
	 * Handles incoming add event requests and writes the event to disk.
	 *
	 * @param {Object} ctx - A dispatcher request context.
	 * @access private
	 */
	addEvent(ctx) {
		try {
			if (!this.mid) {
				throw new AppcdError(codes.NOT_INITIALIZED, 'The telemetry system has not been initialized');
			}

			if (!this.config.enabled || !this.eventsDir) {
				throw new AppcdError(codes.TELEMETRY_DISABLED);
			}

			let { event } = ctx.request;

			if (!event || typeof event !== 'string') {
				throw new AppcdError(codes.BAD_REQUEST, 'Invalid telemetry event');
			}

			if (!/^appcd[.-]/.test(event)) {
				event = `appcd.${event}`;
			}

			const data = Object.assign({}, ctx.request);
			delete data.event;

			const id = uuid.v4();

			const payload = {
				aguid: this.aguid,
				data,
				event,
				id,
				mid:   this.mid,
				seq:   this.seqId++,
				sid:   this.sessionId,
				ts:    new Date().toISOString(),
				ver:   '3',
				deployType: this.deployType
			};

			const filename = path.join(this.eventsDir, id + '.json');

			// make sure the events directory exists
			fs.mkdirsSync(this.eventsDir);

			log('Writing event: %s', highlight(filename));
			log(payload);

			try {
				fs.writeFileSync(filename, JSON.stringify(payload));
			} catch (e) {
				/* istanbul ignore next */
				throw new AppcdError(codes.SERVER_ERROR, 'Failed to write event data: %s', e.message);
			}

			ctx.response = new Response(codes.CREATED);
		} catch (e) {
			ctx.response = e;
		}
	}

	/**
	 * Initializes the telemetry system.
	 *
	 * @param {String} homeDir - The path to the appcd home directory where the machine id will be
	 * persisted to.
	 * @returns {Promise}
	 * @access public
	 */
	async init(homeDir) {
		if (this.mid) {
			return;
		}

		if (!homeDir || typeof homeDir !== 'string') {
			throw new TypeError('Expected home directory to be a non-empty string');
		}

		this.eventsDir = expandPath(this.config.eventsDir || path.join(homeDir, 'telemetry'));

		this.mid = await getMachineId(path.join(homeDir, '.mid'));

		// record now as the last send and start the send timer
		this.lastSend = Date.now();
		this.sendEvents();

		return this;
	}

	/**
	 * Sends telemetry events if telemetry is enabled, and if it's time to send events.
	 *
	 * @access private
	 */
	sendEvents() {
		this.sendTimer = setTimeout(() => {
			const { sendBatchSize, enabled, sendInterval, sendTimeout, url } = this.config;
			const { eventsDir } = this;

			if (!enabled || !url || (this.lastSend + sendInterval) > Date.now() || !eventsDir || !isDir(eventsDir)) {
				// not enabled or not time to send
				return this.sendEvents();
			}

			let sends = 0;

			// sendBatch() is recursive and will continue to scoop up `sendBatchSize` of events
			// until they're all gone
			const sendBatch = () => {
				const batch = [];
				for (const name of fs.readdirSync(eventsDir)) {
					if (jsonRegExp.test(name)) {
						batch.push(path.join(eventsDir, name));
						if (batch.length >= sendBatchSize) {
							break;
						}
					}
				}

				// check if we found any events to send
				if (!batch.length) {
					if (sends) {
						log('No more events to send');
					} else {
						log('No events to send');
					}
					this.lastSend = Date.now();
					return this.sendEvents();
				}

				log(__n(batch.length, 'Sending %%s event', 'Sending %%s events', highlight(batch.length)));

				const json = [];

				for (const file of batch) {
					try {
						json.push(JSON.parse(fs.readFileSync(file)));
					} catch (e) {
						// Rather then squelch the error we'll remove here
						log(`Failed to read ${highlight(file)}, removing`);
						fs.unlinkSync(file);
					}
				}

				this.pending = new Promise(resolve => {
					request({
						json,
						method:  'POST',
						timeout: sendTimeout,
						url
					}, (err, resp) => {
						resolve();

						if (err || resp.statusCode >= 300) {
							error(__n(
								batch.length,
								'Failed to send %%s event: %%s',
								'Failed to send %%s events: %%s',
								highlight(batch.length),
								err ? err.message : `${resp.statusCode} - ${resp.statusMessage}`
							));
							this.lastSend = Date.now();
							return this.sendEvents();
						}

						log(__n(batch.length, 'Successfully sent %%s event', 'Successfully sent %%s events', highlight(batch.length)));

						for (const file of batch) {
							if (isFile(file)) {
								fs.unlinkSync(file);
							}
						}

						sends++;
						sendBatch();
					});
				});
			};

			sendBatch();
		}, 1000);
	}

	/**
	 * Stops sending telemetry events and waits for any pending requests to finish.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async shutdown() {
		clearTimeout(this.sendTimer);

		// wait for the pending post to finish
		await this.pending;
	}

	/**
	 * Scrubs and sets updated config settings.
	 *
	 * @param {Object} config - The config settings to apply.
	 * @access private
	 */
	updateConfig(config) {
		const eventsDir = config.eventsDir || null;
		if (eventsDir !== this.config.eventsDir) {
			this.eventsDir = eventsDir ? expandPath(eventsDir) : null;
		}

		// copy over the config
		Object.assign(this.config, config);

		// make sure things are sane
		if (this.config.sendBatchSize) {
			this.config.sendBatchSize = Math.max(this.config.sendBatchSize, 1);
		}

		// don't let the sendInterval or sendTimeout dip below 1 second
		this.config.sendInterval = Math.max(this.config.sendInterval, 1000);
		this.config.sendTimeout  = Math.max(this.config.sendTimeout, 1000);
	}
}
