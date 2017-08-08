/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import appcdLogger from 'appcd-logger';
import Config from 'appcd-config';
// import fs from 'fs-extra';
import gawk, { isGawked } from 'gawk';
// import path from 'path';
// import pluralize from 'pluralize';
// import request from 'request';
import uuid from 'uuid';

import { DispatcherError, ServiceDispatcher } from 'appcd-dispatcher';
// import { expandPath } from 'appcd-path';
// import { isFile } from 'appcd-fs';
// import { randomBytes } from 'appcd-util';

const logger = appcdLogger('appcd:telemetry');

export default class Telemetry extends ServiceDispatcher {
	/**
	 * Constructs an analytics instance.
	 *
	 * @param {Config} cfg - The initial config object.
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
		 * The daemon config instance.
		 * @type {Config}
		 */
		this.config = Object.assign({
			enabled:       false,
			eventsDir:     null,
			sendBatchSize: 10,
			url:           null
		}, cfg.get('telemetry'));

		gawk.watch(cfg.values, 'telemetry', obj => {
			// TODO: figure out what changed
			this.config = obj;
		});

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
	}
}
