import { EventEmitter } from 'events';
import Server from './Server';
import uuid from 'node-uuid';
import WebSocket from 'ws';

/**
 * The client for connecting to the appcd server.
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
				} else {
					try {
						const json = JSON.parse(data);
						if (json.id) {
							this.emit(json.id, json.data);
						}
					} catch (e) {
						console.log(e);
					}
				}
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

					this.on(id, data => {
						emitter.emit('response', data);
						if (data.eof) {
							this.removeListener(id);
							emitter.emit('end');
						}
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
