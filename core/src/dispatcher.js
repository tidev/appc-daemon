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
	 * Asynchronously dispatch a request. If unable to find a appropriate
	 * handler, an error is returned.
	 *
	 * @param {String} path - The dispatch path to request.
	 * @param {Object} [data={}] - An optional data payload to send.
	 * @returns {Promise}
	 * @access public
	 */
	@autobind
	call(path, data) {
		if (!data || typeof data !== 'object') {
			data = {};
		}

		data.path = path;

		for (let route of this.routes) {
			const m = path.match(route.regexp);
			if (m) {
				const params = m.slice(1);
				params.forEach((param, i) => {
					if (route.keys[i]) {
						data.params || (data.params = {});
						data.params[route.keys[i].name] = param;
					}
				});
				return this.execRoute(path, route, data);
			}
		}

		return Promise.reject(new DispatcherError(404, 'No route'));
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

		this.routes.push({
			path,
			prefix: handler instanceof Dispatcher ? path : null,
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
	 * Executes the route's handler.
	 *
	 * @param {String} path
	 * @param {Object} route
	 * @param {Object} data
	 * @returns {Promise}
	 * @access private
	 */
	async execRoute(path, route, data) {
		if (route.handler instanceof Dispatcher) {
			return await route.handler.call(path.replace(route.prefix, ''), data);
		} else {
			return await route.handler(data);
		}
	}
}
