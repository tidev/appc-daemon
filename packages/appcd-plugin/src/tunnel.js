import appcdLogger from 'appcd-logger';
import PluginError from './plugin-error';
import Response, { AppcdError, codes } from 'appcd-response';
import uuid from 'uuid';

import { DispatcherContext, DispatcherError } from 'appcd-dispatcher';
import { PassThrough } from 'stream';

const { highlight, magenta } = appcdLogger.styles;

/**
 * Orchestrates messages across a tunnel between processes. Both the parent and child process would
 * create their own tunnel instance and wire up event handlers.
 */
export default class Tunnel {
	/**
	 * Creates a tunnel for the specified process.
	 *
	 * @param {ChildProcess|Process} proc - The process object.
	 * @param {Boolean} isParent - Indicates that the tunnel is being created by the parent process.
	 * @param {Function} handler - A callback to handle incoming requests.
	 * @access public
	 */
	constructor(proc, isParent, handler) {
		if (!proc || typeof proc.send !== 'function' || typeof proc.on !== 'function') {
			throw new Error('Invalid process object');
		}

		if (!handler || typeof handler !== 'function') {
			throw new TypeError('Expected handler to be a function');
		}

		this.logger = appcdLogger(isParent ? 'appcd:plugin:tunnel:parent' : 'appcd:plugin:tunnel:child');

		this.remoteName = isParent ? proc.pid : 'parent';

		const onMessage = req => {
			if (!req || typeof req !== 'object') {
				return;
			}

			if (req.id && this.requests[req.id]) {
				return this.requests[req.id](req);
			}

			const send = res => {
				if (!res || typeof res !== 'object') {
					return;
				}

				let message = res;

				if (res instanceof Error) {
					message = Object.assign({}, res, {
						message:    res.message || res.toString(),
						instanceof: res.constructor.name,
						status:     res.status || 500,
						statusCode: res.statusCode || '500',
						type:       'error'
					});
				} else if (res instanceof DispatcherContext) {
					message = {
						message: res.response,
						status:  res.status || codes.OK
					};
				} else if (res.message instanceof Response) {
					message = {
						...res,
						status:  res.message.status || codes.OK,
						message: res.message.toString()
					};
				}

				if (!message.status) {
					message.status = codes.OK;
				}

				if (!message.type && req.type) {
					message.type = req.type;
				}

				const response = {
					id: req.id,
					message
				};

				// this.logger.log('Sending tunnel response to %s:', highlight(this.remoteName), response);
				this.proc.send(response);
			};

			handler(req, send);
		};

		/**
		 * The process establish a tunnel for.
		 * @type {ChildProcess|Process}
		 */
		this.proc = proc.on('message', onMessage);

		/**
		 * A map of pending requests.
		 * @type {Object}
		 */
		this.requests = {};
	}

	/**
	 * Sends a message, but does not wait for a response.
	 *
	 * @param {Object} msg - The message to send.
	 * @access public
	 */
	emit(msg) {
		this.proc.send(msg);
	}

	/**
	 * Sends a message and waits for a response.
	 *
	 * @param {Object|DisptacherContext} ctxOrPayload - An existing dispatcher context or an object
	 * containing the path and message to send.
	 * @returns {Promise}
	 * @access public
	 */
	send(ctxOrPayload) {
		return new Promise((resolve, reject) => {
			const id = uuid.v4();
			let ctx = ctxOrPayload;

			if (!(ctxOrPayload instanceof DispatcherContext)) {
				ctx = new DispatcherContext({
					headers: {},
					path:    ctxOrPayload.path,
					request: typeof ctxOrPayload === 'object' && ctxOrPayload.data || ctxOrPayload || {},
					response: new PassThrough({ objectMode: true }),
					source: null,
					status: 200
				});
			}

			this.requests[id] = ({ message }) => {
				if (message.status) {
					ctx.status = message.status;
				}

				// this.logger.log('Received response from %s:', highlight(this.remoteName), message);

				switch (message.type) {
					case 'error':
						this.logger.log('Deleting request handler: %s', highlight(id), magenta(ctx.request.path));
						delete this.requests[id];

						const status = message.statusCode || message.status;

						switch (message.instanceof) {
							case 'DispatcherError':
								ctx.response = new DispatcherError(status, message.message);
								break;

							case 'PluginError':
								ctx.response = new PluginError(status, message.message);
								break;

							default:
								ctx.response = new AppcdError(status, message.message);
						}

						// `message` is a special setter and we don't want to override the
						delete message.message;

						// mix all public properties from the incoming message into the error object
						Object.assign(ctx.response, message);

						reject(ctx.response);
						break;

					case 'stream':
						resolve(ctx);

						switch (message.data.type) {
							case 'fin':
								if (this.requests[id]) {
									this.logger.log('Deleting request handler: %s', highlight(id), magenta(ctx.request.path));
									delete this.requests[id];
								}
								ctx.response.end();
								break;

							case 'subscribe':
								ctx.request.sid = message.data.sid;

							default:
								if (message.data.message instanceof Response) {
									// we can't send Response objects, so we need to render it now
									message.data.message = message.data.message.toString();
								}

								ctx.response.write(message.data);
						}

						break;

					default:
						this.logger.log('Deleting request handler: %s %s', highlight(id), magenta(ctx.request.path));
						delete this.requests[id];
						if (message.status) {
							ctx.status = message.status;
						}
						ctx.response = message.message;
						resolve(ctx);
				}
			};

			const req = {
				id,
				message: {
					headers: ctx.headers,
					path:    ctx.path,
					request: ctx.request,
					source:  ctx.source
				},
				type: 'request'
			};

			this.logger.log('Sending tunnel request to %s:', highlight(this.remoteName), req);
			this.proc.send(req);
		});
	}
}
