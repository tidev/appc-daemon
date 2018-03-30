import appcdLogger from 'appcd-logger';
import PluginError from './plugin-error';
import Response, { AppcdError } from 'appcd-response';
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

			handler(req, /* send */ res => {
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
						status:  res.status || 200
					};
				} else if (res.message instanceof Response) {
					message = {
						...res,
						status:  res.message.status || 200,
						message: res.message.toString()
					};
				}

				if (!message.status) {
					message.status = 200;
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
			});
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
			let ctx;

			if (ctxOrPayload instanceof DispatcherContext) {
				ctx = ctxOrPayload;
				ctx.request = {
					path: ctxOrPayload.path,
					data: ctxOrPayload.request
				};
			} else {
				ctx = new DispatcherContext({
					request: typeof ctxOrPayload === 'object' && ctxOrPayload || {},
					response: new PassThrough({ objectMode: true }),
					status: 200
				});
			}

			this.requests[id] = ({ message }) => {
				if (message.status) {
					ctx.status = message.status;
				}

				this.logger.log('Received response from %s:', highlight(this.remoteName), message);

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

					case 'subscribe':
						resolve(ctx);
						// fallthrough

					case 'event':
						ctx.request.sid = message.sid;
						// fallthrough

					case 'unsubscribe':
						ctx.response.write(message);
						break;

					case 'fin':
						if (this.requests[id]) {
							this.logger.log('Deleting request handler: %s', highlight(id), magenta(ctx.request.path));
							delete this.requests[id];
						}
						ctx.response.end();
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
				message: ctx.request,
				type: 'request'
			};

			this.logger.log('Sending tunnel request to %s:', highlight(this.remoteName), req);
			this.proc.send(req);
		});
	}
}
