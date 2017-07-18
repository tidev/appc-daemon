/**
 * This code heavily based on koa-66.
 * https://github.com/menems/koa-66
 * The MIT License (MIT)
 * Copyright (c) 2015 blaz
 */

import pathToRegexp from 'path-to-regexp';
import snooplogg from 'snooplogg';

const logger = snooplogg.config({ theme: 'detailed' })('appcd:http:router');
const { highlight, note } = snooplogg.styles;

/**
 * Supported HTTP methods.
 * @type {Array}
 */
export const methods = [
	'options',
	'head',
	'get',
	'post',
	'put',
	'patch',
	'delete'
];

/**
 * A Koa compatible web router.
 */
export default class Router {
	constructor() {
		this.layers = [];
		this.methods = methods;
	}

	/**
	 * Returns Koa middleware that routes a request to the appropriate handler.
	 *
	 * @returns {Function}
	 * @access public
	 */
	routes() {
		return (ctx, next) => {
			const prefix = ctx.route && ctx.route.prefix || '';
			const path = prefix ? ctx.path.replace(prefix, '') : ctx.path;
			const middlewares = [];
			const paramMiddlewares = Object.assign({}, ctx.route && ctx.route.paramMiddlewares);
			let allowedMethods = {};
			let matched;

			// loop through each route and see if it matches
			for (const route of this.layers) {
				const m = path.match(route.regexp);
				if (!m) {
					continue;
				}

				if (route.paramNames) {
					ctx.params = this.parseParams(ctx.params, route.paramNames, path.match(route.regexp).slice(1));
				}

				if (route.paramKey) {
					paramMiddlewares[route.paramKey] = (ctx, next) => route.middleware(ctx, next, ctx.params[route.paramKey]);
					continue;
				}

				if (route.methods) {
					for (const method of route.methods) {
						allowedMethods[method] = 1;
					}
					if (allowedMethods.GET) {
						allowedMethods.HEAD = 1;
					}

					if ((route.methods.indexOf(ctx.method) !== -1) || (ctx.method === 'HEAD' && route.methods.indexOf('GET') !== -1)) {
						matched = true;
						for (const paramKey of Object.keys(ctx.params)) {
							if (paramMiddlewares[paramKey]) {
								middlewares.push({
									fn: paramMiddlewares[paramKey]
								});
								delete paramMiddlewares[paramKey];
							}
						}
					}
				}

				middlewares.push({
					fn: route.middleware,
					path: prefix + route.path,
					prefix: prefix + m[0],
					route
				});
			}

			allowedMethods = Object.keys(allowedMethods);

			if (allowedMethods.length) {
				// 501
				if (this.methods.indexOf(ctx.method.toLowerCase()) === -1) {
					ctx.status = 501;
					return next();
				}

				// 405
				if (!matched) {
					// automatic OPTIONS response
					if (ctx.method === 'OPTIONS') {
						ctx.status = 204;
						return next();
					}

					ctx.status = 405;
					ctx.set('Allow', allowedMethods.filter((value, index, self) => self.indexOf(value) === index).join(', '));
					return next();
				}
			}

			let index = -1;

			return (function dispatch(i) {
				if (i <= index) {
					return Promise.reject(new Error('next() called multiple times'));
				}
				index = i;

				ctx.route = middlewares[i];

				if (ctx.route) {
					ctx.route.paramMiddlewares = paramMiddlewares;
					return Promise.resolve()
						.then(() => ctx.route.fn(ctx, () => dispatch(i + 1)));
				} else {
					return next(ctx);
				}
			}(0));
		};
	}

	/**
	 * Registers a path for a given method and handler.
	 *
	 * @param {String|Array<String>} methods - An array of methods or a single method.
	 * Value may be null (falsey) if the method is not applicable.
	 * @param {String|RegExp} path - The path to register.
	 * @param {String} [paramKey] - The name of the path's parameter key.
	 * @param {Function|Router} middleware - The function to invoke when the route has been matched.
	 * @returns {Router}
	 * @access private
	 */
	register(methods, path, paramKey, middleware) {
		if (methods) {
			methods = methods.map(m => m.toUpperCase());
		}

		if (path && typeof path === 'string' && path !== '(.*)') {
			path = '/' + path
				.replace(/^\/+/i, '')
				.replace(/\/+$/, '')
				.replace(/\/{2,}/, '/');
		}

		// shift args if the paramKey is the middleware
		if (typeof paramKey === 'function' || paramKey instanceof Router) {
			middleware = paramKey;
			paramKey = undefined;
		}

		if (typeof middleware !== 'function' && !(middleware instanceof Router)) {
			throw new TypeError('Expected middleware to be a function');
		}

		const keys = [];

		logger.log('Registering layer: %s %s', highlight(path), methods ? note(`(${methods.join(',')})`) : '');

		this.layers.push({
			path,
			middleware: middleware instanceof Router ? middleware.routes() : middleware,
			regexp: pathToRegexp(path, keys, { end: !(middleware instanceof Router) }),
			paramNames: keys,
			paramKey,
			methods
		});

		return this;
	}

	/**
	 * Mounts the specified middleware at the specified path.
	 *
	 * @param {String|RegExp} path - The path to mount the middleware.
	 * @param {Function|Router} middleware - The middleware function or router instance being mounted.
	 * @returns {Router}
	 * @access public
	 */
	use(...args) {
		if (typeof args[0] !== 'string' && !(args[0] instanceof RegExp)) {
			args.unshift('(.*)');
		}
		args.unshift(null);
		return this.register(...args);
	}

	/**
	 * Adds a callback trigger for a path parameter.
	 *
	 * @param {String} key - The key to register.
	 * @param {Function} callback - The function to invoke for each matching path parameter.
	 * @returns {Router}
	 * @access public
	 */
	param(key, callback) {
		if (typeof key !== 'string') {
			throw new TypeError('Expected key to be a string');
		}
		if (typeof callback !== 'function') {
			throw new TypeError('Expected callback to be a function');
		}
		return this.register(null, '(.*)', key, callback);
	}

	/**
	 * Registers a path for all HTTP methods.
	 *
	 * @param {String|RegExp} path - The key to register.
	 * @param {Function} callback - The function to invoke for each matching path parameter.
	 * @returns {Router}
	 * @access public
	 */
	all(...args) {
		if (typeof args[0] !== 'string' && !(args[0] instanceof RegExp)) {
			args.unshift('/');
		}
		args.unshift(methods);
		return this.register(...args);
	}

	/**
	 * A helper function that parses and decodes URL parameters.
	 *
	 * @param {Object} params - An object to store the params.
	 * @param {Array} paramNames - An array containing the parameter names.
	 * @param {Array} captures - An array of values parsed from the URL.
	 * @returns {Router}
	 * @access private
	 */
	parseParams(params, paramNames, captures) {
		const len = captures.length;
		params = params || {};

		for (let i = 0; i < len; i++) {
			if (paramNames[i]) {
				let c = captures[i];
				params[paramNames[i].name] = c ? decodeURIComponent(c) : c;
			}
		}
		return params;
	}
}

for (const method of methods) {
	/**
	 * OPTIONS, HEAD, GET, POST, PUT, PATCH, and DELETE request handlers.
	 *
	 * @param {String|RegExp} path - The path to register.
	 * @param {Function} callback - The function to fire when the path is matched.
	 * @returns {Router}
	 * @access public
	 */
	Router.prototype[method] = function (...args) {
		if (typeof args[0] !== 'string' && !(args[0] instanceof RegExp)) {
			args.unshift('/');
		}
		args.unshift([ method ]);
		return this.register(...args);
	};
}
