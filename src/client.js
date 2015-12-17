import { EventEmitter } from 'events';
import Server from './Server';
import uuid from 'node-uuid';
import WebSocket from 'ws';

export default class Client extends EventEmitter {
	constructor(opts = {}) {
		super();
		this.hostname = opts.hostname || '127.0.0.1';
		this.port     = opts.port || 1732;
		this.socket   = null;
	}

	connect() {
		return new Promise((resolve, reject) => {
			let socket = this.socket;

			if (socket) {
				return resolve(socket);
			}

			socket = this.socket = new WebSocket('ws://' + this.hostname + ':' + this.port);

			socket.on('message', (data, flags) => {
				if (flags.binary) {
					// ????
				} else {
					try {
						const json = JSON.parse(data);
						if (json.id) {
							this.emit(json.id, json.data);
							if (!json.more) {
								this.removeListener(json.id);
							}
						}
					} catch (e) {}
				}
			});

			socket.on('open', () => {
				resolve(socket);
			});
		});
	}

	request(url, payload) {
		const emitter = new EventEmitter;

		const send = () => {
			setImmediate(() => {
				this.connect()
					.then((socket) => {
						const id = uuid.v4();

						this.on(id, (data) => {
							emitter.emit('response', data);
						});

						socket.send(JSON.stringify(Object.assign({
							version: '1.0',
							url: url,
							id: id
						}, payload || {})));
					});
			});
		};

		new Server()
			.start()
			.then(send)
			.catch(err => {
				if (err.code !== 'ALREADY_RUNNING') {
					throw err;
				}
				send();
			});

		return emitter;
	}

	disconnect() {
		if (this.socket) {
			this.socket.close();
		}
		this.socket = null;
	}
}
