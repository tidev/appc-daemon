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
import { isDir } from 'appcd-fs';
import { osInfo } from 'appcd-util';

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
	 * @param {Config} cfg - The Appc Daemon config object.
	 * @param {String} version - The app version.
	 * @access public
	 */
	constructor(cfg, version) {
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

		/**
		 * The app version.
		 * @type {String}
		 */
		this.version = version;

		// set the config and wire up the watcher
		this.updateConfig(cfg.get('telemetry') || {});
		cfg.watch('telemetry', obj => this.updateConfig(obj));

		// wire up the telemetry route
		this.register('/', this.addEvent.bind(this));

		{
			const { name, version } = osInfo();
			this.osInfo = {
				os:       name || 'unknown',
				osver:    version || 'unknown',
				platform: process.platform
			};
		}
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

			if (!/^appcd[.-]/.test(event) && !/^ti\.(start|end)$/.test(event)) {
				event = `appcd.${event}`;
			}

			const data = Object.assign({}, ctx.request);
			delete data.event;
			delete data.params;

			const id = uuid.v4();

			const payload = Object.assign({
				aguid:       this.aguid,
				app_version: this.version,
				data,
				deploytype:  this.deployType,
				event,
				id,
				mid:         this.mid,
				seq:         this.seqId++,
				sid:         this.sessionId,
				ts:          Date.now(),
				ver:         3
			}, this.osInfo);

			const filename = path.join(this.eventsDir, `${id}.json`);

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

		// send any unsent events
		this.sendEvents();

		return this;
	}

	/**
	 * Sends a batch of events to the server.
	 *
	 * @param {Array.<Object>} batch - An array of telemetry events to send.
	 * @returns {Promise}
	 */
	async sendBatch(batch) {
		log(__n(batch.length, 'Sending %%s event', 'Sending %%s events', highlight(batch.length)));

		const [ err, resp ] = await new Promise(resolve => {
			request({
				json:    batch.map(b => b.evt),
				method:  'POST',
				timeout: this.config.sendTimeout,
				url:     this.config.url
			}, (...args) => resolve(args));
		});

		if (err || resp.statusCode >= 300) {
			error(__n(
				batch.length,
				'Failed to send %%s event: %%s',
				'Failed to send %%s events: %%s',
				highlight(batch.length),
				err ? err.message : `${resp.statusCode} - ${resp.statusMessage}`
			));
		} else {
			log(__n(batch.length, 'Successfully sent %%s event', 'Successfully sent %%s events', highlight(batch.length)));
			await Promise.all(batch.map(({ file }) => fs.remove(file)));
		}
	}

	/**
	 * Sends batches of all events and resolves when done.
	 *
	 * @param {Boolean} [flush] - When `true`, it bypasses the send interval and flushes all unsent
	 * events.
	 * @returns {Promise}
	 */
	sendEvents(flush) {
		return this.pending = Promise.resolve()
			.then(async () => {
				const { eventsDir, lastSend } = this;
				const { enabled, sendBatchSize, sendInterval, url } = this.config;

				const scheduleSendEvents = () => {
					// when flushing, we don't schedule a send
					if (!flush) {
						this.sendTimer = setTimeout(() => this.sendEvents(), 1000);
					}
				};

				if (!enabled || !url || !eventsDir || !isDir(eventsDir) || (!flush && lastSend && (lastSend + sendInterval) > Date.now())) {
					// not enabled or not time to send
					return scheduleSendEvents();
				}

				let batch = [];
				let counter = 0;

				for (const name of fs.readdirSync(eventsDir)) {
					if (jsonRegExp.test(name)) {
						const file = path.join(eventsDir, name);

						try {
							batch.push({
								evt: await fs.readJson(file),
								file
							});
							counter++;
						} catch (e) {
							// Rather then squelch the error we'll remove here
							log(`Failed to read ${highlight(file)}, removing`);
							await fs.remove(file);
						}

						// send batch if full
						if (batch.length >= sendBatchSize) {
							await this.sendBatch(batch);
							batch = [];
						}
					}
				}

				// send remaining events
				if (batch.length) {
					await this.sendBatch(batch);
				}

				// check if we found any events to send
				if (!counter) {
					log('No events to send');
				}

				this.lastSend = Date.now();
				scheduleSendEvents();
			})
			.catch(() => {});
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

		// wait for any remaining events to be sent
		await this.sendEvents(true);
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
