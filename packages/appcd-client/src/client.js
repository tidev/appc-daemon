if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import fs from 'fs';
import msgpack from 'msgpack-lite';
import path from 'path';
import uuid from 'uuid';
import WebSocket from 'ws';

import { arch } from 'appcd-util';
import { EventEmitter } from 'events';
import { locale } from 'appcd-response';

/**
 * The client for connecting to the appcd server.
 */
export default class Client {
	/**
	 * Initializes the client.
	 *
	 * @param {Object} [opts]
	 * @param {String} [opts.host='127.0.0.1'] - The host to connect to.
	 * @param {Number} [opts.port=1732] - The port to connect to.
	 * @param {String} [opts.userAgent] - The user agent containing the name and
	 * version of the client. If not specified, one will be generated.
	 */
	constructor(opts = {}) {
		/**
		 * The websocket to the server.
		 * @type {WebSocket}
		 * @access private
		 */
		this.socket = null;

		/**
		 * An internal map used to dispatch responses to requesters.
		 * @type {Object}
		 * @access private
		 */
		this.requests = {};

		/**
		 * The host to connect to.
		 * @type {String}
		 * @access private
		 */
		this.host = opts.host || '127.0.0.1';

		/**
		 * The port to connect to.
		 * @type {Number}
		 * @access private
		 */
		if (opts.port && (typeof opts.port !== 'number' || opts.port < 1 || opts.port > 65535)) {
			throw new TypeError('Invalid port, expected a number between 1 and 65535');
		}
		this.port = opts.port || 1732;

		/**
		 * The user agent containing the name and version of the client. If not
		 * specified, one will be generated.
		 * @type {String}
		 * @access private
		 */
		this.userAgent = constructUserAgent(opts.userAgent);
	}

	/**
	 * Connects to the server via a websocket. You do not need to call this.
	 * `request()` will automatically call this function.
	 *
	 * @returns {EventEmitter} Emits events `connected`, `close`, and `error`.
	 * @access public
	 */
	connect() {
		const emitter = new EventEmitter;

		// need to delay request so event emitter can be returned and events can
		// be wired up
		setImmediate(() => {
			if (this.socket) {
				emitter.emit('connected', this);
				return;
			}

			const socket = this.socket = new WebSocket(`ws://${this.host}:${this.port}`, {
				headers: {
					'Accept-Language': process.env.APPCD_LOCALE || locale(),
					'User-Agent': this.userAgent
				}
			});

			socket.on('message', (data, flags) => {
				let json = null;
				if (flags.binary) {
					json = msgpack.decode(data);
				} else {
					try {
						json = JSON.parse(data);
					} catch (e) {
						// bad response, shouldn't ever happen
						return;
					}
				}

				if (!json || typeof json !== 'object' || !json.id) {
					return;
				}

				if (this.requests[json.id]) {
					this.requests[json.id](json);
				}
			});

			socket
				.on('open', () => emitter.emit('connected', this))
				.once('close', () => emitter.emit('close'))
				.once('error', err => {
					socket.close();
					this.socket = null;
					emitter.emit('error', err);
				});
		});

		return emitter;
	}

	/**
	 * Issues a request to the server over a websocket.
	 *
	 * @param {String} path - The path to send.
	 * @param {Object} [payload] - An object to send.
	 * @returns {EventEmitter} Emits events `response` and `error`.
	 * @access public
	 */
	request(path, payload) {
		const emitter = new EventEmitter;

		// need to delay request so event emitter can be returned and events can
		// be wired up
		setImmediate(() => {
			const id = uuid.v4();

			return this.connect()
				.on('connected', client => {
					this.requests[id] = response => {
						const status = ~~response.status || 500;
						const statusClass = Math.floor(status / 100);

						switch (statusClass) {
							case 2:
								emitter.emit('response', response.message, response);
								break;

							case 4:
							case 5:
								const err = new Error(status + ' ' + (response.message || 'Server Error'));
								err.errorCode = status;
								err.code = response.code ? String(response.code) : String(status);
								emitter.emit('error', err, response);
						}
					};

					client.socket.send(JSON.stringify({
						version: '1.0',
						path:    path,
						id:      id,
						data:    payload
					}));
				})
				.once('close', () => {
					delete this.requests[id];
				})
				.once('error', err => {
					delete this.requests[id];
					emitter.emit('error', err);
				});
		});

		return emitter;
	}

	/**
	 * Disconnects from the server.
	 *
	 * @access public
	 */
	disconnect() {
		if (this.socket) {
			this.socket.close();
		}
		this.socket = null;
	}
}

/**
 * Generates a user agent string containing the name of the parent-most script
 * name, Node.js version, platform name, and architecture.
 *
 * @param {String} [userAgent] - The invoking client's user agent. This simply needs to be the
 * `name/version`.
 * @returns {String}
 */
function constructUserAgent(userAgent) {
	if (userAgent && typeof userAgent !== 'string') {
		throw new TypeError('Expected user agent to be a string');
	}

	const parts = userAgent ? userAgent.split(' ') : [];

	if (!parts.length) {
		let entry = module;
		while (entry.parent) {
			entry = entry.parent;
		}

		const name = path.basename(entry.filename);
		const root = path.resolve('/');
		let dir = path.dirname(entry.filename);
		let version = '';

		do {
			const pkgJsonFile = path.join(dir, 'package.json');

			try {
				if (fs.statSync(pkgJsonFile)) {
					parts.push(`${name}/${JSON.parse(fs.readFileSync(pkgJsonFile)).version || ''}`);
					break;
				}
			} catch (e) {
				// either the package.json doesn't exist or the JSON was malformed
				if (e.code !== 'ENOENT') {
					// must be malformed JSON, we can stop
					break;
				}
			}

			dir = path.dirname(dir);
		} while (dir !== root);
	}

	parts.push(`appcd-client/${JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'))).version}`);

	if (!parts.some(p => p.indexOf('node/') === 0)) {
		parts.push(`node/${process.version.replace(/^v/, '')}`);
	}

	if (!parts.some(p => p === process.platform)) {
		parts.push(process.platform);
	}

	const architecture = arch();
	if (!parts.some(p => p === architecture)) {
		parts.push(architecture);
	}

	return parts.join(' ');
}
