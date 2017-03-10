import DispatcherError from './dispatcher-error';
import pathToRegExp from 'path-to-regexp';
import snooplogg, { styles } from 'snooplogg';
import Stream from 'stream';

import codes, { statuses } from 'appcd-statuses';
import { PassThrough, Transform } from 'stream';

const logger = snooplogg.config({ theme: 'detailed' })('appcd:dispatcher');
const { highlight } = styles;

/*
class StringifyStream extends Transform {
	_transform(chunk, encoding, callback) {
		console.log('stringifying!');
		this.push(typeof chunk === 'string' || Buffer.isBuffer(chunk) ? chunk : JSON.stringify(chunk));
		callback();
	}
}
*/

/**
 * Cross between an event emitter and a router.
 */
export default class Dispatcher {
	/**
	 * List of registered routes.
	 * @type {Array}
	 */
	routes = [];

	/**
	 * The parent's path.
	 * @type {String}
	 */
	prefix = null;

	/**
	 * Registers a handler to a path.
	 *
	 * @param {String|RegExp|Array<String>|Array<RegExp>} path
	 * @param {Function|Dispatcher} handler
	 * @returns {Dispatcher}
	 * @access public
	 */
	register(path, handler) {
		if (Array.isArray(path)) {
			for (const p of path) {
				this.register(p, handler);
			}
			return this;
		}

		// check if we have a object with a path/handler
		if (path && typeof path === 'object' && path.path && typeof path.handler === 'function') {
			handler = path.handler;
			path = path.path;
		}

		if (typeof path !== 'string' && !(path instanceof RegExp)) {
			throw new TypeError('Invalid path');

		} else if (typeof handler === 'function' || handler instanceof Dispatcher) {
			const keys = [];
			const regexp = pathToRegExp(path, keys, { end: !(handler instanceof Dispatcher) });
			const prefix = handler instanceof Dispatcher ? path : null;

			this.routes.push({
				path,
				prefix,
				handler,
				keys,
				regexp
			});

			// if this is a scoped dispatcher and the path is /, then suppress the
			// redundant log message
			if (!this.prefix || path !== '/') {
				logger.debug(`Registered dispatcher route ${highlight(path)}`);
			}

		} else {
			throw new TypeError('Invalid handler');
		}

		return this;
	}

	/**
	 * Asynchronously dispatch a request. If unable to find a appropriate handler, an error is
	 * returned.
	 *
	 * @param {String} path - The dispatch path to request.
	 * @param {Object} [data={}] - An optional data payload to send.
	 * @returns {Promise}
	 * @access public
	 */
	call(path, data) {
		if (!data || typeof data !== 'object') {
			data = {};
		}

		const ctx = {
			data,
			path,
			response: new PassThrough({ objectMode: true }),
			status: codes.OK
		};

		let index = -1;

		logger.debug(`Searching for route handler: ${highlight(path)}`);

		const dispatch = i => {
			if (i <= index) {
				// next() was called multiple times, but there's nothing we can do about
				// it except break the chain... no error will ever be propagated
				return;
			}
			index = i;

			const route = this.routes[i];
			if (!route) {
				// end of the line
				logger.debug('Route not found: %s', highlight(path));
				throw new DispatcherError(codes.NO_ROUTE);
			}

			logger.trace('Testing route: %s', highlight(route.path));

			const m = ctx.path.match(route.regexp);
			if (!m) {
				return dispatch(i + 1);
			}

			logger.debug('Found matching route: %s', highlight(route.path));

			// extract the params from the path
			delete ctx.params;
			const params = m.slice(1);
			params.forEach((param, i) => {
				if (route.keys[i]) {
					ctx.params || (ctx.params = {});
					ctx.params[route.keys[i].name] = param;
				}
			});

			if (route.handler instanceof Dispatcher) {
				// call the nested dispatcher
				return route.handler.call(path.replace(route.prefix, ''), ctx);
			}

			return new Promise((resolve, reject) => {
				let fired = false;

				logger.trace('calling route handler %d', i);

				let result = route.handler(ctx, function next(result) {
					// go to next route

					if (fired) {
						logger.debug('next() already fired!');
						return;
					}

					fired = true;

					return dispatch(i + 1)
						.then(result => result || ctx)
						.catch(reject);
				});

				logger.trace('listener returned:', result);

				// if we got back a promise, we have to wait
				if (result instanceof Promise) {
					result.then(result => resolve(result || ctx)).catch(reject);
				} else {
					resolve(result || ctx);
				}
			});
		};

		// start the chain and return its promise
		return Promise.resolve()
			.then(() => dispatch(0));
	}

	/**
	 * Returns a Koa.js middleware callback that dispatches the request through the dispatcher's
	 * routes.
	 *
	 * @returns {Function} Koa middleware
	 * @access public
	 */
	callback() {
		/**
		 * A Koa.js middleware function.
		 *
		 * @param {Object} ctx - The Koa context.
		 * @param {Accepts} ctx.accept - Content type negotiation.
		 * @param {koa.Application} ctx.app - The Koa app instance.
		 * @param {Cookies} ctx.cookies - An object containing the parsed cookies.
		 * @param {String} ctx.originalUrl - The original URL from `req.url`.
		 * @param {http.IncomingMessage} ctx.req - The Node.js HTTP server request object.
		 * @param {http.ServerResponse} ctx.res - The Node.js HTTP server response object.
		 * @param {Object} ctx.state - Metadata to pass along to other middlewares.
		 * @param {Function} next - A function to continue to the next middleware.
		 * @returns {Promise}
		 */
		return (ctx, next) => {
			if (ctx.method === 'HEAD') {
				return next();
			}

			const data = {
				data: (ctx.method === 'POST' || ctx.method === 'PUT') && ctx.request && ctx.request.body || {},
				type: 'call',
				sessionId: 'koa'
			};

			return this.call(ctx.originalUrl, data)
				.then(result => {
					ctx.status = result.status;

					//ctx.body = new StringifyStream;
					//result.response.pipe(ctx.body);
					ctx.body = result.response;
				})
				.catch(err => {
					if (err instanceof DispatcherError) {
						if (err.status === codes.NO_ROUTE) {
							return next();
						}
						ctx.status = err.status;
						ctx.body = err.toString();
					} else {
						ctx.status = codes.SERVER_ERROR;
						ctx.body = statuses[codes.SERVER_ERROR];
					}

					logger.error(err);

					return Promise.resolve();
				});
		};
	}
}
