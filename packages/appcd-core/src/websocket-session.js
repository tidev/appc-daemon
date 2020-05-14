import accepts from 'accepts';
import appcdLogger from './logger';
import Dispatcher, { DispatcherContext } from 'appcd-dispatcher';
import EventEmitter from 'events';
import msgpack from 'msgpack-lite';
import Response, { codes, createErrorClass, errorToJSON } from 'appcd-response';

import { IncomingMessage } from 'http';
import { PassThrough, Readable } from 'stream';
import { WebSocket } from 'appcd-http';

const logger = appcdLogger('appcd:core:websocket-session');
const { highlight, magenta, ok, alert, note } = appcdLogger.styles;

/**
 * The counter to track sessions.
 * @type {Number}
 */
let sessionCounter = 0;

/**
 * A custom error for WebSocket session errors.
 */
const WebSocketError = createErrorClass('WebSocketError', {
	defaultStatus:     codes.BAD_REQUEST,
	defaultStatusCode: codes.WEBSOCKET_BAD_REQUEST
});

/**
 * Tracks the state of a WebSocket session and handles the WebSocket subprotocol.
 */
export default class WebSocketSession extends EventEmitter {
	/**
	 * Creates a appcd WebSocket session and wires up the message handler.
	 *
	 * @param {WebSocket} ws - The WebSocket instance.
	 * @param {Request} msg - The Request object from the incoming connection.
	 * @param {Dispatcher} [dispatcher] - The dispatcher instance for testing. If not specified,
	 * uses the root Dispatcher instance.
	 * @access public
	 */
	constructor(ws, msg, dispatcher) {
		if (!(ws instanceof WebSocket)) {
			throw new TypeError('Expected a WebSocket instance');
		}

		if (!(msg instanceof IncomingMessage)) {
			throw new TypeError('Expected a IncomingMessage instance');
		}

		if (dispatcher && !(dispatcher instanceof Dispatcher)) {
			throw new TypeError('Expected a Dispatcher instance');
		}

		super();

		this.sessionId = sessionCounter++;
		this.ws = ws;
		this.msg = msg;
		this.dispatcher = dispatcher || Dispatcher.root;
		this.subscriptions = {};
		this.remoteId = `${ws._socket.remoteAddress}:${ws._socket.remotePort}`;

		let req = null;

		ws.on('message', message => {
			try {
				const startTime = new Date();
				req = typeof message === 'string' ? message : msgpack.decode(message);

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
	 * @returns {Promise}
	 * @access private
	 */
	async handle_1_0(req) {
		if (req.id === undefined) {
			throw new WebSocketError('Request "id" required');
		}

		const { path } = req;
		let ctx = new DispatcherContext({
			headers:  this.msg.headers,
			request: {
				data: req.data || {},
				id:   req.id,
				type: req.type,
				sid:  req.sid
			},
			response: new PassThrough({ objectMode: true }),
			source: 'websocket'
		});

		try {
			ctx = (await this.dispatcher.call(path, ctx)) || ctx;

			const { status, response } = ctx;

			if (response instanceof Readable) {
				// we have a stream

				// listen for the WebSocket to end, then end the response stream so that
				// whatever is writing to the stream knows that the other end has closed
				this.ws
					.once('close', () => response.end())
					.once('error', () => response.end());

				// track if this stream is a pubsub stream so we know to send the `fin`
				let pubsub = false;
				let first = ctx;

				response
					.on('data', message => {
						// data was written to the stream

						if (message.type === 'subscribe') {
							pubsub = true;
						}

						const res = typeof message === 'object' ? message : { message };
						if (message.type || pubsub) {
							res.type = message.type || 'event';
						}

						this.respond({
							ctx: first,
							req,
							res,
							chunked: !pubsub && !first
						});

						first = null;
					})
					.once('end', () => {
						// the stream has ended, if pubsub, send `fin`
						this.respond({
							ctx: first,
							req,
							res: {
								path: req.path,
								type: 'finish',
								fin: true
							}
						});
					})
					.once('error', err => {
						logger.error('%s Response stream error:', note(`[${this.sessionId}]`));
						logger.error(err);
						this.respond({
							ctx: first,
							req,
							res: {
								type: 'error',
								message: err.message || err,
								status: err.status || 500,
								fin: true
							}
						});
					});

			} else if (response instanceof Error) {
				this.respond({ ctx, req, res: response });

			} else {
				this.respond({
					ctx,
					req,
					res: {
						status,
						message: response,
						fin: true
					}
				});
			}
		} catch (err) {
			this.respond({ ctx, req, res: err });
			logger.error(err);
		}
	}

	/**
	 * Ensures the response has an 'id' and a 'type', then sends the response and logs the request.
	 *
	 * @param {Object} params - Required parameters.
	 * @param {DispatcherContext} [params.ctx] - A dispatcher context containing the request info.
	 * @param {Object} params.req - The WebSocket subprotocol request state.
	 * @param {*} params.res - The dispatcher response.
	 * @param {Boolean} [params.chunked=false] - When `true`, signifies this is a subsequent chunk
	 * of streamed data where the request should not be logged and `status` and `statusCode` should
	 * not be added to the response.
	 * @access private
	 */
	respond({ ctx, req, res, chunked }) {
		if (req && req.id) {
			res.id = req.id;
		}
		if (!res.type && req && req.type) {
			res.type = req.type;
		}

		if (res.message instanceof Response) {
			res.status = res.message.status;
			res.message = res.message.toString(accepts(this.msg).languages());
		}

		if (this.ws.readyState === WebSocket.OPEN) {
			let data;
			const info = ctx ? {
				path:      ctx.realPath,
				size:      null,
				source:    ctx.source,
				status:    ctx.status,
				time:      ctx.time,
				userAgent: ctx.headers['user-agent'] || null
			} : {};

			if (res instanceof Error) {
				info.status = res.status || 500;
				info.error = errorToJSON(res);

				data = JSON.stringify({
					...res,
					id:         res.id,
					message:    res.message,
					stack:      res.stack,
					status:     info.status,
					statusCode: String(res.statusCode || '500'),
					type:       'error'
				});
			} else {
				if (!chunked) {
					if (!res.status) {
						res.status = ctx && ctx.status || codes.OK;
					}
					if (!res.statusCode) {
						res.statusCode = String(res.status);
					}
				}

				data = msgpack.encode(res);
			}

			info.size = data.length;

			try {
				this.ws.send(data);
			} catch (e) {
				logger.error('%s Failed to send:', note(`[${this.sessionId}]`));
				logger.error(e);
			}

			if (ctx) {
				this.emit('request', info);
			}
		}

		if (!chunked) {
			this.log(req, res);
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
			msg += ` ${highlight(`${new Date() - req.startTime}ms`)}`;
		}

		logger.log(msg);
	}
}
