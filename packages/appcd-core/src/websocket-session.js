import accepts from 'accepts';
import Dispatcher from 'appcd-dispatcher';
import msgpack from 'msgpack-lite';
import Response, { codes, createErrorClass } from 'appcd-response';
import snooplogg, { styles } from './logger';
import uuid from 'uuid';

import { Readable } from 'stream';
import { WebSocket } from 'appcd-http';

const logger = snooplogg('appcd:core:websocket-session');
const { highlight, magenta, ok, alert, note } = snooplogg.styles;

/**
 * The counter to track sessions.
 * @type {Number}
 */
let sessionCounter = 0;

/**
 * A custom error for WebSocket session errors.
 */
const WebSocketError = createErrorClass('createErrorClass', {
	defaultStatus: codes.BAD_REQUEST,
	defaultCode: codes.WEBSOCKET_BAD_REQUEST
});

/**
 * Tracks the state of a WebSocket session and handles the WebSocket subprotocol.
 */
export default class WebSocketSession {
	/**
	 * Creates a appcd WebSocket session and wires up the message handler.
	 */
	constructor(ws, dispatcher) {
		if (!(ws instanceof WebSocket)) {
			throw new TypeError('Expected a WebSocket instance');
		}

		if (!(dispatcher instanceof Dispatcher)) {
			throw new TypeError('Expected a Dispatcher instance');
		}

		this.sessionId = sessionCounter++;
		this.ws = ws;
		this.dispatcher = dispatcher;
		this.subscriptions = {};
		this.remoteId = `${ws._socket.remoteAddress}:${ws._socket.remotePort}`;

		let req = null;

		ws.on('message', (message, flags) => {
			const startTime = new Date;

			try {
				req = flags.binary ? msgpack.decode(message) : message;

				if (typeof req !== 'string') {
					throw new WebSocketError('Message must be a string');
				}

				try {
					req = JSON.parse(req);
				} catch (e) {
					throw new WebSocketError('Invalid JSON message: %s', e.message);
				}

				if (!req || typeof req !== 'object') {
					throw new WebSocketError('Invalid request');
				}

				req.sessionId = this.sessionId;
				req.startTime = startTime;

				if (!req.version) {
					throw new WebSocketError('Request "version" required');
				}

				const ver = String(req.version);

				if (ver === '1.0') {
					return this.handle_1_0(req);
				}

				throw new WebSocketError('Invalid version "%s"', ver);
			} catch (err) {
				this.respond(req, err);
			}
		});
	}

	/**
	 * Handles v1.0 WebSocket subprotocol requests.
	 *
	 * @param {Object} req - The WebSocket subprotocol request state.
	 * @return {Promise}
	 * @access private
	 */
	handle_1_0(req) {
		if (req.id === undefined) {
			throw new WebSocketError('Request "id" required');
		}

		return this.dispatcher
			.call(req.path, {
				id:        req.id,
				sessionId: req.sessionId,
				data:      req.data || {},
				type:      req.type,
				source:    'websocket'
			})
			.then(({ status, response }) => {
				if (response instanceof Readable) {
					// we have a stream

					// listen for the WebSocket being closed and close the response stream so that
					// whatever is writing to the stream knows that the other end has closed
					this.ws.once('close', () => response.end());

					// track if this stream is a pubsub stream so we know to send the `fin`
					let pubsub = false;
					let first = true;

					response
						.on('data', message => {
							// data was written to the stream

							if (message.type === 'subscribe') {
								pubsub = true;
							}

							let res;
							const type = message.type || (pubsub ? 'publish' : undefined);

							if (typeof message === 'object') {
								res = {
									...message,
									type
								};
							} else {
								res = {
									message,
									type
								};
							}

							this.respond(req, res, !pubsub && !first);
							first = false;
						})
						.once('end', () => {
							// the stream has ended, if pubsub, send `fin`
							if (pubsub) {
								this.respond(req, {
									path: req.path,
									type: 'publish',
									fin: true
								});
							}
						})
						.once('error', err => {
							logger.error('%s Response stream error:', note(`[${this.sessionId}]`));
							logger.error(err);
							this.send({ type: 'event', message: err.message || err, status: err.status || 500, fin: true });
						});

				} else if (response instanceof Error) {
					this.respond(req, response);

				} else {
					this.respond(req, {
						status,
						message: response
					});
				}
			})
			.catch(err => this.respond(req, err));
	}

	/**
	 * Ensures the response has an 'id' and a 'type', then sends the response and logs the request.
	 *
	 * @param {Object} req - The WebSocket subprotocol request state.
	 * @param {*} res - The dispatcher response.
	 * @param {Boolean} [skipLog=false] - When true, does not log the request. This `true` when
	 * sending new, non-pubsub data from a stream.
	 * @access private
	 */
	respond(req, res, skipLog) {
		if (req && req.id) {
			res.id = req.id;
		}
		if (!res.type && req && req.type) {
			res.type = req.type;
		}

		if (res.message instanceof Response) {
			res.status = res.message.status;
			res.message = res.message.toString(accepts(this.ws.upgradeReq).languages());
		}

		this.send(res);
		if (!skipLog) {
			this.log(req, res);
		}
	}

	/**
	 * Sends a response back over the WebSocket.
	 *
	 * @param {*} res - The dispatcher response.
	 * @access private
	 */
	send(res) {
		if (this.ws.readyState !== WebSocket.OPEN) {
			return;
		}

		let data;

		if (res instanceof Error) {
			data = JSON.stringify({
				type:    'error',
				status:  res.status || 500,
				code:    res.code || '500',
				message: res.message,
				id:      res.id
			});
		} else {
			res.status || (res.status = 200);
			data = msgpack.encode(res);
		}

		try {
			this.ws.send(data);
		} catch (e) {
			logger.error('%s Failed to send:', note(`[${this.sessionId}]`));
			logger.error(e);
		}
	}

	/**
	 * Logs a WebSocket subprotocol request.
	 *
	 * @param {Object} req - The WebSocket subprotocol request state.
	 * @param {*} res - The dispatcher response.
	 * @access private
	 */
	log(req, res) {
		let status = res && res.status || (res instanceof Error ? 500 : 200);
		const style = status < 400 ? ok : alert;
		const type = res.type || (req && req.type);

		let msg = note(`[${this.sessionId}]`) + ' ' + highlight(this.remoteId);
		if (type) {
			msg += magenta(` [${type}]`);
		}
		if (req && req.path) {
			msg += highlight(` ${req.path}`);
		}
		msg += ` ${style(status)}`;
		if (res instanceof Error) {
			msg += ` ${style(res.message || res)}`;
		}
		if (req && req.startTime && type !== 'publish') {
			msg += ` ${highlight(`${new Date - req.startTime}ms`)}`;
		}

		logger.log(msg);
	}
}
