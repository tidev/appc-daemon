import appcdLogger from 'appcd-logger';
import bodyParser from 'koa-bodyparser';
import EventEmitter from 'events';
import helmet from 'koa-helmet';
import Koa from 'koa';
import path from 'path';
import pluralize from 'pluralize';
import Router from './router';
import send from 'koa-send';

import { isDir } from 'appcd-fs';
import { Server as WebSocketServer } from 'ws';

const logger = appcdLogger('appcd:http:webserver');
const { alert, highlight, note, notice, ok, yellow } = appcdLogger.styles;

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
	router = new Router();

	/**
	 * The koa app instance.
	 * @type {Koa}
	 */
	app = new Koa();

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
	 * Map of active connections. Used when stopping the web server to drop active connections.
	 * @type {Object}
	 */
	connections = {};

	/**
	 * Initializes the web server.
	 *
	 * @param {Object} opts - An object of options.
	 * @param {String} [opts.hostname] - The hostname to listen on. If a hostname is not specified,
	 * it defaults to listening on all interfaces. Specify `127.0.0.1` to only listen on localhost.
	 * @param {Number} opts.port - The port to listen on.
	 * @param {String} [opts.webroot] - The path to the public served directory. Defaults to the
	 * built-in example.
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

		if (opts.index && typeof opts.index !== 'string') {
			throw new TypeError('Expected index to be a string');
		}

		this.hostname = opts.hostname;
		this.port     = opts.port;
		this.webroot  = opts.webroot;
		this.index    = opts.index;

		function logRequest(ctx, err) {
			const style = ctx.status < 400 ? ok : ctx.status < 500 ? notice : alert;
			const { remoteAddress, remotePort } = ctx.socket;

			logger.log('%s %s %s %s %s%s',
				highlight(remoteAddress + ':' + remotePort),
				yellow(ctx.method),
				highlight(ctx.url),
				style(ctx.status),
				err ? (style(err.message || err) + ' ') : '',
				note((new Date() - ctx.startTime) + 'ms')
			);
		}

		// init the Koa app with helmet and a simple request logger
		this.app
			.use(helmet())
			.use(bodyParser())
			.use((ctx, next) => {
				ctx.startTime = new Date();
				return next()
					.then(() => logRequest(ctx));
			})
			.on('error', (err, ctx) => {
				ctx.status = err.status || 500;
				logRequest(ctx, err);
			});
	}

	/**
	 * Adds a middleware function to the web server. This should be called before calling
	 * `listen()`.
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
	async listen() {
		// make sure that if there is a previous websocket server, it's shutdown to free up the port
		await this.shutdown();

		const webroot = this.webroot || path.resolve(__dirname, '..', 'public');

		return new Promise((resolve, reject) => {
			this.httpServer = this.app
				.use(this.router.routes())
				.use(ctx => send(ctx, ctx.path, { index: this.index || 'index.html', root: webroot }))
				.listen(this.port, this.hostname)
				.once('listening', () => {
					logger.log('Web server listening on %s', highlight(`http://${this.hostname || 'localhost'}:${this.port}`));
					logger.log('Served web root: %s', highlight(webroot));
					resolve();
				})
				.on('connection', conn => {
					const key = conn.remoteAddress + ':' + conn.remotePort;
					logger.log('%s connected', highlight(key));
					this.connections[key] = conn;
					conn.on('close', () => {
						delete this.connections[key];
						logger.log('%s disconnected', highlight(key));
					});
				})
				.on('error', reject);

			// create the websocket server and start listening
			this.websocketServer = new WebSocketServer({
				server: this.httpServer
			});

			this.websocketServer.on('connection', (conn, req) => {
				const { remoteAddress, remotePort } = req.socket;
				const key = remoteAddress + ':' + remotePort;
				logger.log('%s upgraded to WebSocket', highlight(key));

				conn.on('close', () => {
					logger.log('%s closed WebSocket', highlight(key));
				});

				conn.on('error', err => {
					if (err.code !== 'ECONNRESET') {
						logger.error(err);
					}
				});

				this.emit('websocket', conn, req);
			});

			this.websocketServer.on('error', err => logger.error(err));
		});
	}

	/**
	 * Closes the web server and websocket server. After 30 seconds, all connections are terminated.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async shutdown() {
		if (this.websocketServer) {
			await new Promise(resolve => {
				// close the websocket server
				logger.log('Closing WebSocket server');
				this.websocketServer.close(() => {
					this.websocketServer = null;
					resolve();
				});
			});
		}

		if (this.httpServer) {
			await new Promise(resolve => {
				// close the http server
				logger.log('Closing HTTP server');
				this.httpServer.close(() => {
					// manually kill any open connections
					const conns = Object.keys(this.connections);
					logger.log(pluralize('Dropping %s connection', conns.length), highlight(conns.length));
					for (const key of conns) {
						this.connections[key].destroy();
						delete this.connections[key];
					}

					this.httpServer = null;
					resolve();
				});
			});
		}
	}
}
