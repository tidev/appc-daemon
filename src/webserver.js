import autobind from 'autobind-decorator';
import { EventEmitter } from 'events';
import helmet from 'koa-helmet';
import Koa from 'koa';
import path from 'path';
import Router from 'koa-router';
import send from 'koa-send';
import { Server as WebSocketServer } from 'ws';

export default class WebServer extends EventEmitter {
	router = new Router;

	app = new Koa;

	server = null;

	httpServer = null;

	constructor(opts = {}) {
		super();

		this.hostname = opts.hostname || '127.0.0.1';
		this.port     = opts.port || 1732;

		// init the Koa app with helmet and a simple request logger
		this.app
			.use(helmet())
			.use((ctx, next) => {
				const start = new Date;
				return next().then(() => {
					appcd.logger.info('%s %s %s %s',
						ctx.method,
						ctx.url,
						appcd.logger.chalk[ctx.status < 400 ? 'green' : ctx.status < 500 ? 'yellow' : 'red'](ctx.status),
						appcd.logger.chalk.cyan((new Date - start) + 'ms')
					);
				});
			});
	}

	/**
	 * Adds a middleware function to the web server.
	 *
	 * @param {Function} middleware
	 * @returns {WebServer}
	 * @access public
	 */
	use(middleware) {
		this.app.use(middleware);
		return this;
	}

	@autobind
	listen() {
		return Promise.resolve()
			// make sure that if there is a previous websocket server, it's shutdown to free up the port
			.then(this.close)
			.then(() => {
				return new Promise((resolve, reject) => {
					const route = this.router.routes();
					this.app.use(route);

					// static file serving middleware
					this.app.use(async (ctx) => {
						await send(ctx, ctx.path, { root: path.resolve(__dirname, '..', 'public') });
					});

					this.httpServer = this.app.listen(this.port, this.hostname, () => {
						appcd.logger.info('Server listening on port ' + appcd.logger.chalk.cyan(this.port));
						resolve();
					});

					// create the websocket server and start listening
					this.server = new WebSocketServer({
						server: this.httpServer
					});

					this.server.on('connection', ws => {
						this.emit('websocket', ws);
					});
				});
			});
	}

	@autobind
	close() {
		return Promise.resolve()
			.then(() => {
				if (this.server) {
					return new Promise((resolve, reject) => {
						this.server.close(() => {
							this.server = null;
							resolve();
						});
					});
				}
			})
			.then(() => {
				if (this.httpServer) {
					return new Promise((resolve, reject) => {
						this.httpServer.close(() => {
							this.httpServer = null;
							resolve();
						});
					});
				}
			});
	}
}
