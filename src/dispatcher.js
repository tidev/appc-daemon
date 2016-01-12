import autobind from 'autobind-decorator';
import pathToRegExp from 'path-to-regexp';

/**
 * Cross between an event emitter and a router.
 */
export default class Dispatcher {
	routes = [];

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
		} else if (typeof handler === 'function') {
			this.addRoute(path, handler);
		} else if (handler instanceof Dispatcher) {
			handler.routes.forEach(route => {
				this.addRoute(path + route.path, route.handler);
			});
		} else {
			throw new TypeError('Invalid handler');
		}

		return this;
	}

	/**
	 * Asynchronously dispatch a request. If unable to find a appropriate
	 * handler, an error is returned.
	 *
	 * @param {String} path
	 * @param {Object} [data={}]
	 * @returns {Promise}
	 * @access public
	 */
	@autobind
	dispatch(path, data) {
		if (!data || typeof data !== 'object') {
			data = {};
		}

		return new Promise((resolve, reject) => {
			if (!this.routes.some(route => {
				const m = path.match(route.regexp);
				if (m) {
					const params = m.slice(1);
					params.forEach((param, i) => {
						if (route.keys[i]) {
							data.params || (data.params = {});
							data.params[route.keys[i].name] = param;
						}
					});
					this.execRoute(route, data).then(resolve, reject);
					return true;
				}
			})) {
				reject(new Error('No route'));
			}
		});
	}

	/**
	 * Adds a route to the list of routes.
	 *
	 * @param {String|RegExp} path
	 * @param {Function} handler
	 * @access private
	 */
	addRoute(path, handler) {
		const keys = [];
		const regexp = pathToRegExp(path, keys);

		this.routes.push({
			path,
			handler,
			keys,
			regexp
		});
	}

	/**
	 * Executes the route's handler.
	 *
	 * @param {Object} route
	 * @param {Object} data
	 * @returns {Promise}
	 * @access private
	 */
	async execRoute(route, data) {
		await route.handler(data);
	}
}
