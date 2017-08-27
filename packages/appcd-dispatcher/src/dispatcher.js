import appcdLogger from 'appcd-logger';
import DispatcherContext from './dispatcher-context';
import DispatcherError from './dispatcher-error';
import pathToRegExp from 'path-to-regexp';
import Response, { AppcdError, codes } from 'appcd-response';
import ServiceDispatcher from './service-dispatcher';

import { PassThrough } from 'stream';

const logger = appcdLogger('appcd:dispatcher');
const { highlight } = appcdLogger.styles;
const stripRegExp = /\x1B\[\d+m/g;

let rootInstance = null;

/**
 * Cross between an event emitter and a router.
 */
export default class Dispatcher {
	/**
	 * The root dispatcher instance.
	 * @type {Dispatcher}
	 */
	static get root() {
		if (!rootInstance) {
			rootInstance = new Dispatcher();
		}
		return rootInstance;
	}

	/**
	 * Runs the root dispatcher instance's `call()`.
	 * @returns {Promise}
	 * @access public
	 */
	static call(...args) {
		return Dispatcher.root.call(...args);
	}

	/**
	 * Runs the root dispatcher instance's `callback()`.
	 * @returns {Function}
	 * @access public
	 */
	static callback(...args) {
		return Dispatcher.root.callback(...args);
	}

	/**
	 * Runs the root dispatcher instance's `register()`.
	 * @returns {Dispatcher}
	 * @access public
	 */
	static register(...args) {
		return Dispatcher.root.register(...args);
	}

	/**
	 * Runs the root dispatcher instance's `unregister()`.
	 * @returns {Dispatcher}
	 * @access public
	 */
	static unregister(...args) {
		return Dispatcher.root.unregister(...args);
	}

	/**
	 * List of registered routes.
	 * @type {Array.<Object>}
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
				request: typeof payload === 'object' && payload || {},
				response: new PassThrough({ objectMode: true }),
				status: 200
			});
		}
		ctx.path = path;
		if (!ctx.realPath) {
			ctx.realPath = path;
		}

		let index = -1;

		logger.log('Searching for route handler: %s', highlight(path));

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
				logger.log('Route not found: %s', highlight(path));
				throw new DispatcherError(codes.NOT_FOUND);
			}

			logger.log('Testing route: %s', highlight(route.path));

			const m = ctx.path.match(route.regexp);
			if (!m) {
				return dispatch(i + 1);
			}

			logger.log('Found matching route: %s', highlight(route.path));

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
				logger.log('Calling dispatcher handler %s', highlight(route.prefix));
				return route.handler.call(path.replace(route.prefix, '') || '/', ctx);
			}

			return new Promise((resolve, reject) => {
				let fired = false;

				logger.log('Invoking route %s handler...', highlight(route.path));

				let result = route.handler(ctx, function next() {
					// go to next route

					if (fired) {
						logger.log('next() already fired!');
						return;
					}

					fired = true;

					logger.log('Route %s handler passed to next route', highlight(route.path));

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

			const dispatcherCtx = new DispatcherContext({
				headers: ctx.req && ctx.req.headers || {},
				request: (ctx.method === 'POST' || ctx.method === 'PUT') && ctx.request && ctx.request.body || {},
				response: new PassThrough({ objectMode: true }),
				status: 200,
				source: 'http'
			});

			return this.call(ctx.originalUrl, dispatcherCtx)
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
	 * @example
	 * dispatcher.register('/some/path', ctx => {});
	 *
	 * @example
	 * dispatcher.register('/some/path', new Dispatcher());
	 *
	 * @example
	 * dispatcher.register(new ServiceDispatcher(...));
	 *
	 * @example
	 * dispatcher.register('/some/path', new ServiceDispatcher(...));
	 *
	 * @example
	 * dispatcher.register({ path: '/some/path', handler: ctx => {} });
	 *
	 * @example
	 * dispatcher.register('/some/path', { handler: ctx => {} });
	 *
	 * @param {ServiceDispatcher|Object|String|RegExp|Array<String>|Array<RegExp>} path - The path
	 * to register the handler to. This can also be a `ServiceDispatcher` instance or any object
	 * that has a path and a handler.
	 * @param {Function|Dispatcher|ServiceDispatcher} handler - A function to call when the path matches.
	 * @returns {Dispatcher}
	 * @access public
	 */
	register(path, handler) {
		if (Array.isArray(path)) {
			for (const p of path) {
				this.register(p, handler);
			}
		} else {
			const handle = this.normalize(path, handler);
			handle.keys = [];
			handle.regexp = pathToRegExp(handle.path, handle.keys, { end: !(handle.handler instanceof Dispatcher) });
			handle.prefix = handle.handler instanceof Dispatcher ? handle.path : null;
			this.routes.push(handle);

			// if this is a scoped dispatcher and the path is /, then suppress the
			// redundant log message
			if (path !== '/') {
				logger.log(`Registered dispatcher route ${highlight(handle.path)}`);
			}
		}

		return this;
	}

	/**
	 * Unregisters a dispatch handler.
	 *
	 * @param {ServiceDispatcher|Object|String|RegExp|Array<String>|Array<RegExp>} path - The path
	 * to register the handler to. This can also be a `ServiceDispatcher` instance or any object
	 * that has a path and a handler.
	 * @param {Function|Dispatcher|ServiceDispatcher} handler - A function to call when the path matches.
	 * @returns {Dispatcher}
	 * @access public
	 */
	unregister(path, handler) {
		if (Array.isArray(path)) {
			for (const p of path) {
				this.unregister(p, handler);
			}
		} else {
			const handle = this.normalize(path, handler);
			for (let i = 0; i < this.routes.length; i++) {
				if (this.routes[i].path === handle.path && this.routes[i].origHandler === handle.handler) {
					this.routes.splice(i, 1);
					break;
				}
			}
		}

		return this;
	}

	/**
	 * Normalizes the arguments to `register()` and `unregister()`.
	 *
	 * @param {ServiceDispatcher|Object|String|RegExp|Array<String>|Array<RegExp>} path - The path
	 * to register the handler to. This can also be a `ServiceDispatcher` instance or any object
	 * that has a path and a handler.
	 * @param {Function|Dispatcher|ServiceDispatcher} handler - A function to call when the path matches.
	 * @returns {Object}
	 * @access private
	 */
	normalize(path, handler) {
		// check if the `path` is a ServiceDispatcher or any object with a path and handler callback
		if (path && typeof path === 'object' && path.hasOwnProperty('path') && typeof path.handler === 'function') {
			handler = path.handler;
			path = path.path;
		}

		if (typeof path !== 'string' && !(path instanceof RegExp)) {
			throw new TypeError('Invalid path');
		}

		if (path === '') {
			path = '/';
		}

		// need to keep a reference to the original handler just in case it's a ServiceDispatcher
		const origHandler = handler;

		if (handler instanceof ServiceDispatcher) {
			if (handler.path) {
				handler = new Dispatcher().register(handler);
			} else {
				handler = handler.handler;
			}
		}

		if (typeof handler !== 'function' && !(handler instanceof Dispatcher)) {
			throw new TypeError('Invalid handler');
		}

		return {
			path,
			handler,
			origHandler
		};
	}
}
