import DispatcherError from './dispatcher-error';
import pathToRegExp from 'path-to-regexp';
import Response, { AppcdError, codes } from 'appcd-response';
import snooplogg, { styles } from 'snooplogg';

import { PassThrough } from 'stream';

const logger = snooplogg.config({ theme: 'detailed' })('appcd:dispatcher');
const { highlight } = styles;
const stripRegExp = /\x1B\[\d+m/g;

/**
 * A context that contains request information and is routed through the dispatcher.
 */
class DispatcherContext {
	/**
	 * Mixes the context parameters into this instance.
	 *
	 * @param {Object} params - Various context-specific parameters.
	 */
	constructor(params) {
		Object.assign(this, params);
	}
}

let rootInstance = null;

/**
 * Cross between an event emitter and a router.
 */
export default class Dispatcher {
	/**
	 * The root dispatcher instance.
	 * @type {Dispatcher}
	 * @access {public}
	 */
	static get root() {
		if (!rootInstance) {
			rootInstance = new Dispatcher;
		}
		return rootInstance;
	}

	/**
	 * Runs the root dispatcher instance's `call()`.
	 * @access public
	 */
	static call(...args) {
		return this.root.call(...args);
	}

	/**
	 * Runs the root dispatcher instance's `callback()`.
	 * @access public
	 */
	static callback(...args) {
		return this.root.callback(...args);
	}

	/**
	 * Runs the root dispatcher instance's `register()`.
	 * @access public
	 */
	static register(...args) {
		return this.root.register(...args);
	}

	/**
	 * List of registered routes.
	 * @type {Array}
	 */
	routes = [];

	/**
	 * Asynchronously dispatch a request. If unable to find a appropriate handler, an error is
	 * returned.
	 *
	 * @param {String} path - The dispatch path to request.
	 * @param {Object|DispatcherContext} [payload={}] - An optional data payload to send.
	 * @returns {Promise}
	 * @access public
	 */
	call(path, payload) {
		if (typeof path !== 'string') {
			throw new TypeError('Expected path to be a string');
		}

		let ctx;
		if (payload instanceof DispatcherContext) {
			ctx = payload;
		} else {
			ctx = new DispatcherContext({
				payload: typeof payload === 'object' && payload || {},
				response: new PassThrough({ objectMode: true }),
				status: 200
			});
		}
		ctx.path = path;

		let index = -1;

		logger.trace('Searching for route handler: %s', highlight(path));

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
				throw new DispatcherError(codes.NOT_FOUND);
			}

			logger.trace('Testing route: %s', highlight(route.path));

			const m = ctx.path.match(route.regexp);
			if (!m) {
				return dispatch(i + 1);
			}

			logger.trace('Found matching route: %s', highlight(route.path));

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
				logger.trace('Calling dispatcher handler %s', highlight(route.prefix));
				return route.handler.call(path.replace(route.prefix, ''), ctx);
			}

			return new Promise((resolve, reject) => {
				let fired = false;

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
			.then(() => dispatch(0))
			.then(ctx => {
				if (ctx.response instanceof Response) {
					ctx.status = ctx.response.status;
				}
				return ctx;
			});
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

			const payload = {
				data: (ctx.method === 'POST' || ctx.method === 'PUT') && ctx.request && ctx.request.body || {},
				headers: ctx.req && ctx.req.headers || {},
				source: 'http'
			};

			return this.call(ctx.originalUrl, payload)
				.then(result => {
					if (result.response instanceof Response) {
						ctx.status = result.response.status || codes.OK;
						ctx.body = result.response.toString(ctx.request && ctx.request.acceptsLanguages()).replace(stripRegExp, '');
					} else {
						ctx.status = result.status;
						ctx.body = result.response;
					}
				})
				.catch(err => {
					if (err instanceof AppcdError) {
						if (err.status === codes.NOT_FOUND) {
							return next();
						}
						ctx.status = err.status || codes.SERVER_ERROR;
					} else {
						ctx.status = codes.SERVER_ERROR;
					}

					logger.error(err);
					ctx.body = err.toString(ctx.request && ctx.request.acceptsLanguages());

					return Promise.resolve();
				});
		};
	}

	/**
	 * Registers a handler to a path.
	 *
	 * @param {ServiceDispatcher|Object|String|RegExp|Array<String>|Array<RegExp>} path - The path
	 * to register the handler to. This can also be a `ServiceDispatcher` instance or any object
	 * that has a path and a handler.
	 * @param {Function|Dispatcher} handler - A function to call when the path matches.
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

		// check if we have a ServiceDispatcher or any object with a path and handler callback
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
			if (path !== '/') {
				logger.debug(`Registered dispatcher route ${highlight(path)}`);
			}

		} else {
			throw new TypeError('Invalid handler');
		}

		return this;
	}
}
