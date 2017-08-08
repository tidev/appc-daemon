import Response, { AppcdError } from 'appcd-response';
import snooplogg from 'snooplogg';
import uuid from 'uuid';

import { DispatcherContext } from 'appcd-dispatcher';
import { PassThrough } from 'stream';

const { log } = snooplogg.config({ theme: 'detailed' })(process.connected ? 'appcd:plugin:tunnel:child' : 'appcd:plugin:tunnel:parent');
const { highlight } = snooplogg.styles;
const { magenta } = snooplogg.chalk;

/**
 * Orchestrates messages across a tunnel between processes. Both the parent and child process would
 * create their own tunnel instance and wire up event handlers.
 */
export default class Tunnel {
	/**
	 * Creates a tunnel for the specified process.
	 *
	 * @param {ChildProcess|Process} proc - The process object.
	 * @param {Function} handler - A callback to handle incoming requests.
	 * @access public
	 */
	constructor(proc, handler) {
		if (!proc || typeof proc.send !== 'function' || typeof proc.on !== 'function') {
			throw new Error('Invalid process object');
		}

		if (!handler || typeof handler !== 'function') {
			throw new TypeError('Expected handler to be a function');
		}

		this.remoteName = process.connected ? 'parent' : proc.pid;

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
					message = {
						statusCode: res.statusCode || '500',
						message:    res.message,
						stack:      res.stack,
						status:     res.status || 500,
						type:       'error'
					};
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

				log(new Error('foo').stack);
				log('Sending tunnel response to %s:', highlight(this.remoteName), response);
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
	 * @param {Object|DispatcherContext} payload - The message to send.
	 * @returns {Promise}
	 * @access public
	 */
	send(payload) {
		return new Promise((resolve, reject) => {
			const id = uuid.v4();

			const ctx = new DispatcherContext({
				request: typeof payload === 'object' && payload || {},
				response: new PassThrough({ objectMode: true }),
				status: 200
			});

			this.requests[id] = ({ message }) => {
				if (message.status) {
					ctx.status = message.status;
				}

				log('Received response from %s:', highlight(this.remoteName), message);

				switch (message.type) {
					case 'error':
						log('Deleting request handler: %s', highlight(id), magenta(ctx.request.path));
						delete this.requests[id];
						ctx.response = new AppcdError(message.code, message.message);
						if (message.stack) {
							ctx.response.stack = message.stack;
						}
						reject(ctx.response);
						break;

					case 'subscribe':
						resolve(ctx);
						// fallthrough
					case 'event':
					case 'unsubscribe':
						ctx.response.write(message);
						break;

					case 'fin':
						if (this.requests[id]) {
							log('Deleting request handler: %s', highlight(id), magenta(ctx.request.path));
							delete this.requests[id];
						}
						ctx.response.end();
						break;

					default:
						log('Deleting request handler: %s %s', highlight(id), magenta(ctx.request.path));
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

			log('Sending tunnel request to %s:', highlight(this.remoteName), req);
			this.proc.send(req);
		});
	}
}
