import appc from 'node-appc';
import { EventEmitter } from 'events';
import path from 'path';
import uuid from 'node-uuid';
import WebSocket from 'ws';

/**
 * The client for connecting to the appcd server.
 *
 * @extends {EventEmitter}
 */
export default class Client extends EventEmitter {
	/**
	 * The websocket to the server.
	 * @type {WebSocket}
	 */
	socket = null;

	/**
	 * Initializes the client.
	 *
	 * @param {Object} [opts]
	 * @param {String} [opts.hostname='127.0.0.1'] - The host to connect to.
	 * @param {Number} [opts.port=1732] - The port to connect to.
	 * @param {String} [opts.userAgent] - The user agent containing the name and
	 * version of the client.
	 * @param {Boolean} [opts.startServer=true] - Start the server if it's not
	 * already running.
	 */
	constructor(opts = {}) {
		super();

		// if we don't have an user agent, then try to generate one
		this.hostname    = opts.hostname || '127.0.0.1';
		this.port        = opts.port || 1732;
		this.userAgent   = opts.userAgent || generateUserAgent();
		this.startServer = opts.startServer !== false;
	}

	/**
	 * Connects to the server via a websocket.
	 *
	 * @returns {Promise}
	 * @emits {<request id>} Emitted when a specific request has received a response.
	 * @emits {error} Emitted when a request error has occurred.
	 * @access public
	 */
	connect() {
		return new Promise((resolve, reject) => {
			let socket = this.socket;

			if (socket) {
				return resolve(socket);
			}

			socket = this.socket = new WebSocket('ws://' + this.hostname + ':' + this.port);

			socket.on('message', (data, flags) => {
				if (flags.binary) {
					// unsupported
					return;
				}

				let json = null;
				try {
					json = JSON.parse(data);
				} catch (e) {
					this.emit('error', new Error('Error parsing server response: ' + e.message));
					return;
				}

				if (!json || typeof json !== 'object' || !json.id) {
					return;
				}

				this.emit(json.id, json);
			});

			socket.on('open', () => resolve(socket));
			socket.on('close', () => this.emit('close'));
			socket.on('error', reject);
		});
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

		const send = () => {
			this.connect()
				.then(socket => {
					const id = uuid.v4();

					this.on(id, response => {
						switch (Math.floor(~~response.status / 100)) {
							case 2:
								emitter.emit('response', response.data);
								break;

							case 4:
							case 5:
								const err = new Error(response.status + ' ' + (response.error || 'An error occurred'));
								err.errorCode = response.status;
								emitter.emit('error', err);
						}
					});

					socket.send(JSON.stringify({
						version:   '1.0',
						path:      path,
						id:        id,
						userAgent: this.userAgent,
						data:      payload
					}));
				})
				.catch(err => emitter.emit('error', err));
		};

		// need to delay request so event emitter can be returned and events can
		// be wired up
		setImmediate(() => {
			if (!this.startServer) {
				return send();
			}

			// we must require the server at runtime to workaround circular dependencies
			const Server = require('./server');

			new Server({
				appcd: {
					allowExit: false,
					daemonize: true
				}
			})
				.start()
				.then(send)
				.catch(err => {
					if (err.code !== 'ALREADY_RUNNING') {
						emitter.emit('error', err);
					}
					send();
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
 * @returns {String}
 */
function generateUserAgent() {
	let entry = module;
	while (module.parent) {
		entry = module.parent;
	}

	const name = path.basename(entry.filename);
	const root = path.resolve('/');
	let dir = path.dirname(entry.filename);
	let version = '';

	while (1) {
		const pkgJsonFile = path.join(dir, 'package.json');
		if (fs.existsSync(pkgJsonFile)) {
			try {
				version = JSON.parse(fs.readFileSync(pkgJsonFile)).version || '';
			} catch (e) {
				// squeltch
			}
			break;
		}

		dir = path.dirname(dir);
		if (dir === root) {
			break;
		}
	}

	return `${name}/${version} node/${process.version.replace(/^v/, '')} ${process.platform} ${process.arch}`;
}
