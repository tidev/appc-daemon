import { EventEmitter } from 'events';
import Server from './Server';
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
	 * @param {String} [opts.hostname=127.0.0.1]
	 * @param {Number} [opts.port=1732]
	 */
	constructor(opts = {}) {
		super();
		this.hostname = opts.hostname || '127.0.0.1';
		this.port     = opts.port || 1732;
	}

	/**
	 * Connects to the server via a websocket.
	 *
	 * @returns {Promise}
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

			socket.on('open', () => {
				resolve(socket);
			});

			socket.on('error', reject);
		});
	}

	/**
	 * Issues a request to the server over a websocket.
	 *
	 * @param {String} path
	 * @param {Object} [payload]
	 * @returns {EventEmitter}
	 * @access public
	 */
	request(path, payload) {
		const emitter = new EventEmitter;

		// need to delay request so event emitter can be returned and events
		// can be wired up
		setImmediate(() => {
			this.connect()
				.then(socket => {
					const id = uuid.v4();

					this.on(id, response => {
						switch (Math.floor(~~response.status / 100)) {
							case 2:
								emitter.emit('response', response.data);
								break;

							case 3:
								// unsupported
								break;

							case 4:
							case 5:
								const err = new Error(response.status + ' ' + (response.error || 'An error occurred'));
								err.errorCode = response.status;
								emitter.emit('error', err);
						}

						// if (data.eof) {
						// 	this.removeListener(id);
						// 	emitter.emit('end');
						// }
					});

					socket.send(JSON.stringify({
						version: '1.0',
						path: path,
						id: id,
						data: payload
					}));
				})
				.catch(err => {
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
