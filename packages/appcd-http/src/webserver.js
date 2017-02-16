import bodyParser from 'koa-bodyparser';
import helmet from 'koa-helmet';
import Koa from 'koa';
import path from 'path';
import Router from './router';
import send from 'koa-send';

import { EventEmitter } from 'events';
import { Server as WebSocketServer } from 'ws';

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
	 * @param {String} opts.hostname - The hostname to listen on.
	 * @param {Number} opts.port - The port to listen on.
	 */
	constructor(opts = {}) {
		super();

		this.hostname = opts.hostname;
		this.port     = opts.port;

		// init the Koa app with helmet and a simple request logger
		this.app
			.use(helmet())
			.use(bodyParser())
			.use((ctx, next) => {
				const start = new Date;

				// unify the context to be compatible with dispatcher contexts
				ctx.data = appc.util.mergeDeep(ctx.data, ctx.request.body);

				// set the user agent
				ctx.userAgent = ctx.request.headers['user-agent'] || `Web ${ctx.request.protocol}`;

				return next().then(() => {
					appcd.logger.info('%s %s %s %s',
						ctx.method,
						ctx.url,
						appcd.logger[ctx.status < 400 ? 'ok' : ctx.status < 500 ? 'notice' : 'alert'](ctx.status),
						appcd.logger.highlight((new Date - start) + 'ms')
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
					this.app.use(this.router.routes());

					// static file serving middleware
					this.app.use(async (ctx) => {
						await send(ctx, ctx.path, { root: path.resolve(__dirname, '..', 'public') });
					});

					this.httpServer = this.app.listen(this.port, this.hostname, () => {
						appcd.logger.info('Web server listening on ' + appcd.logger.highlight('http://localhost:' + this.port));
						resolve();
					});

					this.httpServer.on('connection', conn => {
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
