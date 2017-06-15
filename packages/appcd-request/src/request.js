/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import Dispatcher from 'appcd-dispatcher';
import fs from 'fs';
import path from 'path';
import _request from 'request';
import snooplogg from 'snooplogg';

import { isFile } from 'appcd-fs';

const logger = snooplogg.config({ theme: 'detailed' })('appcd:request');
const { alert, ok, note } = snooplogg.styles;

/**
 * Makes an HTTP request.
 *
 * @param {Object} [params] - Request parameters.
 * @param {Function} [callback] - A function to call when the request has completed.
 * @returns {Promise}
 */
export default function request(params, callback) {
	if (!params || typeof params !== 'object') {
		return Promise.reject(new TypeError('Expected parameters to be an object'));
	}

	if (callback && typeof callback !== 'function') {
		return Promise.reject(new TypeError('Expected callback to be a function'));
	}

	return Dispatcher
		.call('/appcd/config/network')
		.then(ctx => {
			return new Promise((resolve, reject) => {
				let timeout = false;

				const timer = setTimeout(() => {
					logger.warn('Fetching config timed out');
					timeout = true;
					resolve();
				}, 1000);

				ctx.response.on('data', msg => {
					if (msg.type === 'event') {
						const conf = Object.assign({}, msg.message);

						// ca file
						const caFile = conf.caFile && typeof conf.caFile === 'string' && path.resolve(conf.caFile);
						if (isFile(caFile)) {
							conf.ca = fs.readFileSync(caFile);
							delete conf.caFile;
						}

						// cert file
						const certFile = conf.certFile && typeof conf.certFile === 'string' && path.resolve(conf.certFile);
						if (isFile(certFile)) {
							conf.cert = fs.readFileSync(certFile);
							delete conf.certFile;
						}

						// key file
						const keyFile = conf.keyFile && typeof conf.keyFile === 'string' && path.resolve(conf.keyFile);
						if (isFile(keyFile)) {
							conf.key = fs.readFileSync(keyFile);
							delete conf.keyFile;
						}

						clearTimeout(timer);
						resolve(conf);
					}
				});
			});
		})
		.catch(err => {
			if (err.status !== 404) {
				logger.warn('Failed to load default network configuration:', err);
			}
			return Promise.resolve();
		})
		.then(conf => new Promise((resolve, reject) => {
			conf = Object.assign({ method: 'GET' }, conf, params);

			// configure proxy
			const proxyType = conf.url && conf.url.indexOf('https') === 0 ? 'httpsProxy' : 'httpProxy';
			if (conf[proxyType]) {
				conf.proxy = conf[proxyType];
			}
			delete conf.httpProxy;
			delete conf.httpsProxy;

			// console.log(conf);

			const req = _request(conf, callback)
				.on('response', response => {
					const { headers, statusCode } = response;
					logger.log(
						'%s %s %s %s',
						note(conf.method),
						conf.url,
						statusCode < 400 ? ok(statusCode) : alert(statusCode),
						headers.hasOwnProperty('content-length') ? note(`(${snooplogg.humanize.filesize(headers['content-length'])})`) : ''
					);
				})
				.on('error', () => {});

			resolve(req);
		}));
}
