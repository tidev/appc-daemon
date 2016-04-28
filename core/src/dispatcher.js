import autobind from 'autobind-decorator';
import pathToRegExp from 'path-to-regexp';

/**
 * A custom error for dispatcher errors.
 */
export class DispatcherError extends Error {
	constructor(status, message) {
		super(message);
		this.message = message;
		this.status = status;
		Error.captureStackTrace(this, this.constructor);
	}

	toString() {
		return this.message;
	}
}

/**
 * Cross between an event emitter and a router.
 */
export default class Dispatcher {
	/**
	 * A map of status codes and their descriptions.
	 * @type {Object}
	 */
	static statusCodes = {
		'200': 'OK',
		'400': 'Bad request',
		'404': 'File not found',
		'500': 'Server error',
		'505': 'Unsupported version'
	};

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
	@autobind
	register(path, handler) {
		if (Array.isArray(path)) {
			path.forEach(p => {
				this.register(p, handler);
			});
		} else if (typeof path !== 'string' && !(path instanceof RegExp)) {
			throw new TypeError('Invalid path');
		} else if (typeof handler === 'function' || handler instanceof Dispatcher) {
			this.addRoute(path, handler);
		} else {
			throw new TypeError('Invalid handler');
		}

		return this;
	}

	/**
	 * Adds a route to the list of routes.
	 *
	 * @param {String|RegExp} path
	 * @param {Function|Dispatcher} handler
	 * @access private
	 */
	addRoute(path, handler) {
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
			appcd.logger.debug('Registered dispatcher route ' + appcd.logger.highlight(path));
		}
	}

	/**
	 * Asynchronously dispatch a request. If unable to find a appropriate
	 * handler, an error is returned.
	 *
	 * @param {String} path - The dispatch path to request.
	 * @param {Object} [ctx={}] - An optional data payload to send.
	 * @returns {Promise}
	 * @access public
	 */
	@autobind
	call(path, ctx) {
		if (!ctx || typeof ctx !== 'object') {
			ctx = {};
		}

		ctx.path = path;
		ctx.status = 200;

		let index = -1;

		const dispatch = i => {
			if (i <= index) {
				// next() was called multiple times, but there's nothing we can do about
				// it except break the chain... no error will ever be propagated
				return Promise.reject(new Error('next() was called multiple times'));
			}
			index = i;

			const route = this.routes[i];
			if (!route) {
				// end of the line
				if (ctx.status !== 404) {
					ctx.status = 404;
				}
				return Promise.reject(new DispatcherError(404, 'No route'));
			}

			const m = ctx.path.match(route.regexp);
			if (!m) {
				return dispatch(i + 1);
			}

			// extract the params from the path
			delete ctx.params;
			const params = m.slice(1);
			params.forEach((param, i) => {
				if (route.keys[i]) {
					ctx.params || (ctx.params = {});
					ctx.params[route.keys[i].name] = param;
				}
			});

			return new Promise((resolve, reject) => {
				let fired = null;
				let pending = false;
				let result;
				let wait = false;

				if (route.handler instanceof Dispatcher) {
					// call the nested dispatcher
					route.handler
						.call(path.replace(route.prefix, ''), ctx)
						.then(resolve, reject);
					return;
				}

				// call the handler
				// make note of the arity so we know if we have to wait
				wait = route.handler.length > 1;
				result = route.handler(ctx, function next(err) {
					fired = { err };

					if (err) {
						if (!pending) {
							return Promise.reject(err);
						}
						return reject(err);
					}

					return dispatch(i + 1)
						.then(ctx2 => {
							if (pending) {
								resolve(ctx2 || ctx);
							}
						})
						.catch(err => {
							if (!pending) {
								return Promise.reject(err);
							}
							reject(err);
						});
				});

				if (result instanceof Promise) {
					return result.then(resolve, reject);
				}

				if (fired) {
					// handler was synchronous and next() was already called,
					// so resolve this promise
					return fired.err ? reject(fired.err) : resolve(ctx);
				}

				// handler was asynchronous and we must wait for next() to be called
				if (wait) {
					pending = true;
					return;
				}

				// no need to wait for anything async and everythign is fired,
				// so resolve this promise
				resolve(result);
			});
		};

		// start the chain and return its promise
		return dispatch(0)
			.catch(err => Promise.reject(err));
	}
}
