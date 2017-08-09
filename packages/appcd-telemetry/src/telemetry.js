/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import appcdLogger from 'appcd-logger';
import Config from 'appcd-config';
import Dispatcher from 'appcd-dispatcher';
import fs from 'fs-extra';
import gawk, { isGawked } from 'gawk';
import getMachineId from 'appcd-machine-id';
import path from 'path';
import request from 'appcd-request';
import Response, { AppcdError, codes } from 'appcd-response';
import uuid from 'uuid';

import { expandPath } from 'appcd-path';
// import { isFile } from 'appcd-fs';

const { log } = appcdLogger('appcd:telemetry');

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

		if (!cfg.values || !isGawked(cfg.values)) {
			throw new TypeError('Expected config values to be gawked');
		}

		super();

		/**
		 * The Appc Daemon application guid.
		 * @type {String}
		 */
		this.aguid = cfg.get('appcd.guid');
		if (!this.aguid || typeof this.aguid !== 'string') {
			throw new Error('Config is missing a required, valid "appcd.guid"');
		}

		/**
		 * The daemon config instance.
		 * @type {Config}
		 */
		this.config = Object.assign({
			enabled:       false,
			eventsDir:     null,
			sendBatchSize: 10,
			sendInterval:  60000, // 1 minute
			url:           null
		}, cfg.get('telemetry'));

		gawk.watch(cfg.values, 'telemetry', obj => {
			const eventsDir = obj.eventsDir || null;
			if (eventsDir !== this.config.eventsDir) {
				this.initEventsDir(eventsDir);
			}

			// copy over the config
			Object.assign(this.config, obj);

			// make sure things are sane
			if (this.config.sendBatchSize) {
				this.config.sendBatchSize = Math.max(this.config.sendBatchSize, 1);
			}

			// don't let the sendInterval dip below 1 second
			this.config.sendInterval = Math.max(this.config.sendInterval, 1000);
		});

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

			if (!this.config.enabled) {
				throw new AppcdError(codes.TELEMETRY_DISABLED);
			}

			const { event } = ctx.request;

			if (!event || typeof event !== 'string') {
				throw new AppcdError(codes.BAD_REQUEST, 'Invalid telemetry event');
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
				ver:   '3'
			};

			const filename = path.join(this.eventsDir, id + '.json');
			try {
				fs.writeFileSync(filename, JSON.stringify(payload));
			} catch (e) {
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

		this.initEventsDir(this.config.eventsDir || path.join(homeDir, 'telemetry'));

		this.mid = await getMachineId(path.join(homeDir, '.mid'));

		// record now as the last send and start the send timer
		this.lastSend = Date.now();
		this.sendTimer = setTimeout(() => this.sendEvents(), 1000);

		return this;
	}

	/**
	 * Initializes the directory where the telemetry event data is saved.
	 *
	 * @param {String} dir - The directory to store the event data in.
	 * @access private
	 */
	initEventsDir(dir) {
		if (dir) {
			this.eventsDir = expandPath(dir);
			fs.mkdirsSync(this.eventsDir);
		} else {
			this.eventsDir = null;
		}
	}

	/**
	 * Sends telemetry events if telemetry is enabled, there's enough events to fill a batch, and
	 * it's time to send events.
	 *
	 * @access private
	 */
	sendEvents() {
		if (!this.config.enabled
			|| !this.config.url
			|| this.lastSend + this.config.sendInterval < Date.now()) {
			// not time to send
			this.sendTimer = setTimeout(() => this.sendEvents(), 1000);
			return;
		}

		// time to send!
		log('Sending events');

		// request({ params })
		//	.then(req => {})
		//	.catch(err => {});

		// TODO: check batch size and send!
		this.sendTimer = setTimeout(() => this.sendEvents(), 1000);
	}

	/**
	 * Stops sending telemetry events and waits for any pending requests to finish.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async shutdown() {
		clearTimeout(this.sendTimer);

		// TODO: wait for any pending requests to finish
	}
}
