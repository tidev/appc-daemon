/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import appcdLogger from 'appcd-logger';
import fs from 'fs-extra';
import msgpack from 'msgpack-lite';
import path from 'path';
import uuid from 'uuid';
import WebSocket from 'ws';

import { arch } from 'appcd-util';
import { EventEmitter } from 'events';
import { locale } from 'appcd-response';

const { log } = appcdLogger('appcd:client');
const { alert, highlight, note, ok } = appcdLogger.styles;

/**
 * The client for connecting to the appcd server.
 */
export default class Client {
	/**
	 * Initializes the client.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {String} [opts.host='127.0.0.1'] - The host to connect to.
	 * @param {Number} [opts.port=1732] - The port to connect to.
	 * @param {String} [opts.userAgent] - The user agent containing the name and
	 * version of the client. If not specified, one will be generated.
	 * @access public
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
		const emitter = new EventEmitter();

		// need to delay request so event emitter can be returned and events can
		// be wired up
		setImmediate(async () => {
			try {
				if (this.socket) {
					emitter.emit('connected', this);
					return;
				}

				const headers = {
					'User-Agent': this.userAgent
				};

				const localeValue = process.env.APPCD_LOCALE || await locale();
				if (localeValue) {
					headers['Accept-Language'] = localeValue;
				}

				const url = `ws://${this.host}:${this.port}`;
				log(`Connecting to ${highlight(url)}`);
				const socket = this.socket = new WebSocket(url, { headers });

				socket
					.on('message', data => {
						let json = null;
						if (typeof data === 'string') {
							try {
								json = JSON.parse(data);
							} catch (e) {
								// bad response, shouldn't ever happen
								emitter.emit('warning', `Server returned invalid JSON: ${e.message}`);
								return;
							}
						} else {
							json = msgpack.decode(data);
						}

						if (json && typeof json === 'object' && this.requests[json.id]) {
							this.requests[json.id](json);
						} else {
							emitter.emit('warning', 'Server response is not an object or has an invalid id');
						}
					})
					.on('open', () => emitter.emit('connected', this))
					.once('close', () => emitter.emit('close'))
					.once('error', err => {
						socket.close();
						this.socket = null;
						emitter.emit('error', err);
					});
			} catch (e) {
				emitter.emit('error', e);
			}
		});

		return emitter;
	}

	/**
	 * Issues a request to the server over a websocket.
	 *
	 * @param {String|Object} pathOrParams - The path to request or an object containing the path,
	 * data, and type.
	 * @param {String} [pathOrParams.path] - The path to request.
	 * @param {Object} [pathOrParams.data] - An object to send.
	 * @param {String} [pathOrParams.type] - The request type. Valid types include `call`,
	 * `subscribe`, and `unsubscribe`.
	 * @returns {EventEmitter} Emits events `response` and `error`.
	 * @access public
	 */
	request(pathOrParams) {
		if (!pathOrParams || (typeof pathOrParams !== 'string' && typeof pathOrParams !== 'object')) {
			throw new TypeError('Expected non-empty path or parameters object');
		}

		const emitter = new EventEmitter();
		const id = uuid.v4();
		const startTime = new Date();
		const req = {
			version: '1.0',
			path: pathOrParams,
			id
		};

		if (typeof pathOrParams === 'object') {
			Object.assign(req, pathOrParams);
		}

		if (!req.path || typeof req.path !== 'string') {
			throw new TypeError('Expected path to be a non-empty string');
		}

		if (req.data && (typeof req.data !== 'object' || Array.isArray(req.data))) {
			throw new TypeError('Expected data to be an object');
		}

		if (req.type && typeof req.type !== 'string') {
			throw new TypeError('Expected type to be a string');
		}

		// need to delay request so event emitter can be returned and events can
		// be wired up
		setImmediate(() => {
			return this.connect()
				.on('connected', client => {
					this.requests[id] = response => {
						const status = response.status = ~~response.status || 500;
						const statusClass = Math.floor(status / 100);
						const style = status < 400 ? ok : alert;

						// no need for the id anymore
						delete response.id;

						log(`${style(status)} ${highlight(req.path)} ${note(`${new Date() - startTime}ms`)}`);

						switch (statusClass) {
							case 2:
								if (response.type !== 'finish') {
									emitter.emit('response', response.message, response);
								}
								// `fin` exists on the last message from the request which can be
								// any message type, not just `finish`
								if (response.fin) {
									emitter.emit('close');
								}
								break;

							case 4:
							case 5:
								const err = new Error(response.message || 'Server Error');
								if (!response.statusCode) {
									response.statusCode = String(status);
								}
								for (const prop of Object.keys(response)) {
									// we need to use defineProperty() to force properties to be created
									Object.defineProperty(err, prop, {
										configurable: true,
										enumerable:   true,
										value:        response[prop],
										writable:     true
									});
								}
								emitter.emit('error', err, response);
						}
					};

					log('Sending request:', req);

					client.socket.send(JSON.stringify(req));
				})
				.on('warning', (...args) => emitter.emit('warning', ...args))
				.once('close', () => {
					delete this.requests[id];
					emitter.emit('close');
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

		do {
			const pkgJsonFile = path.join(dir, 'package.json');

			try {
				parts.push(`${name}/${fs.readJsonSync(pkgJsonFile).version || ''}`);
				break;
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
