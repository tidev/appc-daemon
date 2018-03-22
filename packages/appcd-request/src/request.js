/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import appcdLogger from 'appcd-logger';
import Dispatcher from 'appcd-dispatcher';
import fs from 'fs';
import path from 'path';
import _request from 'request';

import { isFile } from 'appcd-fs';
import { Stream } from 'stream';

const logger = appcdLogger('appcd:request');
const { alert, ok, note } = appcdLogger.styles;
const { humanize } = appcdLogger;

/**
 * Makes an HTTP request.
 *
 * Note: The returned `Promise` will always resolve and never rejects.
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
		.then(({ response }) => {
			if (!response || typeof response !== 'object' || !(response instanceof Stream)) {
				return {};
			}

			return new Promise(resolve => {
				const timer = setTimeout(() => {
					logger.warn('Fetching config timed out');
					resolve();
				}, 1000);

				response.on('data', msg => {
					if (msg.type === 'event') {
						clearTimeout(timer);
						resolve(msg.message);
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
		.then(conf => new Promise(resolve => {
			const {
				APPCD_NETWORK_CA_FILE,
				APPCD_NETWORK_PROXY,
				APPCD_NETWORK_STRICT_SSL
			} = process.env;

			conf = Object.assign({ method: 'GET' }, conf, params);

			if (APPCD_NETWORK_CA_FILE && isFile(APPCD_NETWORK_CA_FILE)) {
				conf.ca = fs.readFileSync(APPCD_NETWORK_CA_FILE).toString();
			}

			if (APPCD_NETWORK_PROXY) {
				conf.proxy = APPCD_NETWORK_PROXY;
			}

			if (APPCD_NETWORK_STRICT_SSL !== undefined && APPCD_NETWORK_STRICT_SSL !== 'false') {
				conf.strictSSL = true;
			}

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
						headers.hasOwnProperty('content-length') ? note(`(${humanize.filesize(headers['content-length'])})`) : ''
					);
				})
				.on('error', () => {});

			resolve(req);
		}));
}
