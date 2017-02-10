import autobind from 'autobind-decorator';
import pathToRegExp from 'path-to-regexp';
import snooplogg, { snooplogg as foo, chalk } from 'snooplogg';

const logger = snooplogg.config({ theme: 'detailed' })('appcd:dispatcher');
const highlight = chalk.cyan;

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
				ctx.status = 404;
				throw new DispatcherError(404, 'No route');
			}

			logger.trace(`Testing route: ${route.path}`);

			const m = ctx.path.match(route.regexp);
			if (!m) {
				return dispatch(i + 1);
			}

			logger.debug(`Founding matching route: ${highlight(route.path)}`);

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

				logger.trace(`calling route handler ${i}`);

				let result = route.handler(ctx, function next(result) {
					if (fired) {
						logger.debug('next() already fired!');
						return;
					}

					fired = true;

					return dispatch(i + 1)
						.then(ctx2 => ctx2 || ctx)
						.catch(reject);
				});

				logger.trace('listener returned:', result);

				// if we got back a promise, we have to wait
				if (result instanceof Promise) {
					return result.then(resolve, reject);
				}

				resolve(result);
			});
		};

		// start the chain and return its promise
		return Promise.resolve()
			.then(() => dispatch(0))
			.catch(err => Promise.reject(err));
	}
}
