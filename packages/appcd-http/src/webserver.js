import bodyParser from 'koa-bodyparser';
import EventEmitter from 'events';
import helmet from 'koa-helmet';
import Koa from 'koa';
import path from 'path';
import Router from './router';
import send from 'koa-send';
import snooplogg from 'snooplogg';

import { isDir } from 'appcd-fs';
import { Server as WebSocketServer } from 'ws';

const logger = snooplogg.config({ theme: 'detailed' })('appcd:http:webserver');
const { alert, highlight, notice, ok } = snooplogg.styles;

/**
 * The internal web server that serves up API and WebSocket requests.
 *
 * @extends {EventEmitter}
 */
export default class WebServer extends EventEmitter {
	/**
	 * The root koa router.
	 * @type {Router}
	 */
	router = new Router;

	/**
	 * The koa app instance.
	 * @type {Koa}
	 */
	app = new Koa;

	/**
	 * The WebSocket server instance.
	 * @type {WebSocketServer}
	 */
	websocketServer = null;

	/**
	 * The HTTP server instance.
	 * @type {http.Server}
	 */
	httpServer = null;

	/**
	 * Map of active connections. Used when stopping the web server to drop
	 * active connections.
	 * @type {Object}
	 */
	connections = {};

	/**
	 * Initializes the web server.
	 *
	 * @param {Object} opts - An object of options.
	 * @param {String} [opts.hostname] - The hostname to listen on. If a
	 * hostname is not specified, it defaults to listening on all interfaces.
	 * Specify `127.0.0.1` to only listen on localhost.
	 * @param {Number} opts.port - The port to listen on.
	 * @param {String} [opts.webroot] - The path to the public served directory.
	 * Defaults to the built-in example.
	 */
	constructor(opts = {}) {
		super();

		if (!opts || typeof opts !== 'object') {
			throw new TypeError('Expected options to be an object');
		}

		if (opts.hostname && typeof opts.hostname !== 'string') {
			throw new TypeError('Expected hostname to be a string');
		}

		if (!opts.port || typeof opts.port !== 'number') {
			throw new TypeError('Expected port to be positive integer between 1 and 65535');
		}

		if (opts.port < 1 || opts.port > 65535) {
			throw new RangeError('Expected port to be positive integer between 1 and 65535');
		}

		if (opts.webroot) {
			if (typeof opts.webroot !== 'string') {
				throw new TypeError('Expected web root directory to be a string');
			}

			if (!isDir(opts.webroot)) {
				throw new Error(`Web root directory does not exist or is not a directory: ${opts.webroot}`);
			}
		}

		this.hostname = opts.hostname;
		this.port     = opts.port;
		this.webroot  = opts.webroot;

		// init the Koa app with helmet and a simple request logger
		this.app
			.use(helmet())
			.use(bodyParser())
			.use((ctx, next) => {
				const start = new Date;

				// unify the context to be compatible with dispatcher contexts
				// ctx.data = appc.util.mergeDeep(ctx.data, ctx.request.body);

				// set the user agent
				// ctx.userAgent = ctx.request.headers['user-agent'] || `Web ${ctx.request.protocol}`;

				return next()
					.then(() => {
						logger.log('%s %s %s %s',
							ctx.method,
							ctx.url,
							(ctx.status < 400 ? ok : ctx.status < 500 ? notice : alert)(ctx.status),
							highlight((new Date - start) + 'ms')
						);
					});
			});
	}

	/**
	 * Adds a middleware function to the web server.
	 *
	 * @param {Function} middleware - A middleware function to add to the Koa app.
	 * @returns {WebServer}
	 * @access public
	 */
	use(middleware) {
		this.app.use(middleware);
		return this;
	}

	/**
	 * Finishes wiring up the web server routes and starts the web server and
	 * websocket server.
	 *
	 * @returns {Promise}
	 * @emits {websocket} Emitted when a new WebSocket connection has been established.
	 * @access public
	 */
	listen() {
		return Promise.resolve()
			// make sure that if there is a previous websocket server, it's shutdown to free up the port
			.then(this.close)
			.then(() => {
				return new Promise((resolve, reject) => {
					this.httpServer = this.app
						.use(this.router.routes())
						.use(async (ctx) => {
							await send(ctx, ctx.path, { root: this.webroot || path.resolve(__dirname, '..', 'public') });
						})
						.listen(this.port, this.hostname)
						.once('listening', () => {
							logger.log('Web server listening on ' + highlight('http://localhost:' + this.port));
							resolve();
						})
						.on('connection', conn => {
							const key = conn.remoteAddress + ':' + conn.remotePort;
							this.connections[key] = conn;
							conn.on('close', () => {
								delete this.connections[key];
							});
						});

					// create the websocket server and start listening
					this.websocketServer = new WebSocketServer({
						server: this.httpServer
					});

					this.websocketServer.on('connection', conn => {
						this.emit('websocket', conn);
					});
				});
			});
	}

	/**
	 * Closes the web server and websocket server. After 30 seconds, all
	 * connections are terminated.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	close() {
		return Promise.resolve()
			.then(() => {
				if (this.websocketServer) {
					return new Promise((resolve, reject) => {
						// close the websocket server
						this.websocketServer.close(() => {
							this.websocketServer = null;
							resolve();
						});
					});
				}
			})
			.then(() => {
				if (this.httpServer) {
					return new Promise((resolve, reject) => {
						// close the http server
						this.httpServer.close(() => {
							this.httpServer = null;
							resolve();
						});

						// manually kill any open connections
						Object.keys(this.connections).forEach(key => {
							this.connections[key].destroy();
						});
					});
				}
			});
	}
}
