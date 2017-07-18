import Response, { AppcdError } from 'appcd-response';
import snooplogg from 'snooplogg';
import uuid from 'uuid';

import { DispatcherContext } from 'appcd-dispatcher';
import { PassThrough } from 'stream';

const { log } = snooplogg.config({ theme: 'detailed' })(process.connected ? 'appcd:plugin:tunnel:child' : 'appcd:plugin:tunnel:parent');
const { highlight } = snooplogg.styles;

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

		/**
		 * The process establish a tunnel for.
		 * @type {ChildProcess|Process}
		 */
		this.proc = proc.on('message', req => {
			if (req && typeof req === 'object') {
				if (req.id && this.requests[req.id]) {
					this.requests[req.id](req);
				} else {
					handler(req, /* send */ res => {
						if (res instanceof Error) {
							res = {
								code:    res.code || '500',
								message: res.message,
								status:  res.status || 500,
								type:    'error'
							};
						} else if (res instanceof DispatcherContext) {
							res = {
								message: res.response,
								status:  res.status || 200
							};
						} else if (res.message instanceof Response) {
							res = {
								status: res.message.status || 200,
								message: res.message.toString()
							};
						}

						res.id = req.id;
						if (!res.status) {
							res.status = 200;
						}
						if (!res.type && req.type) {
							res.type = req.type;
						}

						this.proc.send(res);
					});
				}
			}
		});

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

			let ctx;
			if (payload instanceof DispatcherContext) {
				ctx = payload;
			} else {
				ctx = new DispatcherContext({
					request: typeof payload === 'object' && payload || {},
					response: new PassThrough({ objectMode: true }),
					status: 200
				});
			}

			this.requests[id] = msg => {
				if (msg.status) {
					ctx.status = msg.status;
				}

				switch (msg.type) {
					case 'error':
						delete this.requests[id];
						ctx.response = new AppcdError(msg.code, msg.message);
						reject(ctx);
						break;

					case 'subscribe':
						resolve(ctx);
					case 'event':
					case 'unsubscribe':
						if (msg.fin) {
							if (msg.type === 'unsubscribe') {
								delete this.requests[id];
							}
							ctx.response.end(msg);
						} else {
							ctx.response.write(msg);
						}
						break;

					default:
						delete this.requests[id];
						if (msg.status) {
							ctx.status = msg.status;
						}
						ctx.response = msg.message;
						resolve(ctx);
				}
			};

			log('Sending tunnel request: %s', ctx.path || '', ctx.request);

			this.proc.send({
				id,
				path: ctx.path,
				data: ctx.request
			});
		});
	}
}
