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
					console.info('%s %s %s %s',
						ctx.method,
						ctx.url,
						console.chalk[ctx.status < 400 ? 'green' : ctx.status < 500 ? 'yellow' : 'red'](ctx.status),
						console.chalk.cyan((new Date - start) + 'ms')
					);
				});
			});
	}

	use(middleware) {
		this.app.use(middleware);
		return this;
	}

	listen() {
		// make sure that if there is a previous websocket server, it's shutdown to free up the port
		this.close();

		const route = this.router.routes();
		this.app.use(route);

		// static file serving middleware
		this.app.use(async (ctx) => {
			await send(ctx, ctx.path, { root: path.resolve(__dirname, '..', 'public') });
		});

		// create the websocket server and start listening
		this.server = new WebSocketServer({
			server: this.app.listen(this.port, this.hostname, () => {
				console.info('Server listening on port ' + console.chalk.cyan(this.port));
			})
		});

		this.server.on('connection', ws => {
			this.emit('websocket', ws);
		});

		return this;
	}

	close() {
		if (this.server) {
			this.server.close();
			this.server = null;
		}

		return this;
	}
}
