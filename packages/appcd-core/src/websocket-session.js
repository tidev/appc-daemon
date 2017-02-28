import Dispatcher from 'appcd-dispatcher';
import msgpack from 'msgpack-lite';
import snooplogg, { styles } from './logger';

import { WebSocket } from 'appcd-http';

const logger = snooplogg('appcd:websocket-session');
const { highlight, lowlight, ok, notice, alert } = snooplogg.styles;

class WebSocketRequest {
	constructor(session) {
		this.req = null;
		this.session = session;
		this.startTime = new Date;
	}

	parse(message) {
		try {
			if (typeof message !== 'string') {
				throw new Error('Message must be a string');
			}

			try {
				this.req = JSON.parse(message);
			} catch (e) {
				throw new Error(`Invalid request object: ${e.message}`);
			}

			if (!this.req || typeof this.req !== 'object') {
				throw new Error('Invalid request object');
			}

			if (!this.req.version) {
				throw new Error('Request "version" required');
			}

			const ver = String(this.req.version);
			switch (ver) {
				case '1.0':
					if (!this.req.path) {
						throw new Error('Request "path" required');
					}

					if (this.req.id === undefined) {
						throw new Error('Request "id" required');
					}

					this.session.dispatcher
						.call(this.req.path, this.req.data)
						.catch(err => {
							this.send(new Error(`Bad Request: ${err.message || err}`));
						})
						.then(result => {
							// TODO: response might be a ReadableStream!
							this.send({
								status: result.status,
								response: result.response
							});
						});

					break;

				default:
					throw new Error(`Invalid version "${ver}"`);
			}
		} catch (e) {
			e.status = 400;
			this.send(e);
		}
	}

	send(response, opts = {}) {
		if (typeof response === 'string') {
			response = {
				response: response
			};
		}

		try {
			let err;

			if (response instanceof Error) {
				err = response;
				response = {
					status: err.status || (err.status = 500),
					response: err.message || err.toString()
				};
				if (this.req && this.req.id) {
					response.id = this.req.id;
				}
				this.session.ws.send(JSON.stringify(response));
			} else {
				if (!response.status) {
					response.status = 200; // assume the request was successful
				}
				if (this.req && this.req.id) {
					response.id = this.req.id;
				}
				opts.binary = true;
				this.session.ws.send(msgpack.encode(response), opts);
			}

			const style = response.status < 400 ? ok : response.status < 500 ? notice : alert;

			logger.log('%s %s %s %s%s',
				highlight(this.session.remoteId),
				this.req.path || 'null',
				style(response.status),
				err ? (style(err.message || err) + ' ') : '',
				highlight((new Date - this.startTime) + 'ms')
			);
		} catch (e) {
			logger.error(`Failed to send: ${e.message || e}`);
		}
	}
}

export default class WebSocketSession {
	/**
	 * Creates a appcd WebSocket session and wires up the message handler.
	 */
	constructor(ws, dispatcher) {
		if (!(ws instanceof WebSocket)) {
			throw new TypeError('Expected a WebSocket object');
		}

		if (!(dispatcher instanceof Dispatcher)) {
			throw new TypeError('Expected a Dispatcher object');
		}

		logger.debug('Wiring up new WebSocket session');

		this.ws = ws;
		this.dispatcher = dispatcher;
		this.remoteId = `${ws._socket.remoteAddress}:${ws._socket.remotePort}`;

		ws.on('message', (message, flags) => {
			new WebSocketRequest(this)
				.parse(flags.binary ? msgpack.decode(message) : message);
		});
	}
}
