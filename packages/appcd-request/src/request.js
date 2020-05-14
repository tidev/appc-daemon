/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import appcdLogger from 'appcd-logger';
import Dispatcher from 'appcd-dispatcher';
import fs from 'fs';
import humanize from 'humanize';
import path from 'path';
import _request from 'request';

import { isFile } from 'appcd-fs';
import { Stream } from 'stream';

const logger = appcdLogger('appcd:request');
const { alert, ok, note } = appcdLogger.styles;

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
		})
		.then(conf => new Promise(resolve => {
			const {
				APPCD_NETWORK_CA_FILE,
				APPCD_NETWORK_STRICT_SSL,
				APPCD_NETWORK_PROXY,
				HTTP_PROXY,
				HTTPS_PROXY
			} = process.env;

			conf = {
				method: 'GET',
				...conf,
				...params
			};

			// ca file
			if (APPCD_NETWORK_CA_FILE && isFile(APPCD_NETWORK_CA_FILE)) {
				conf.ca = fs.readFileSync(APPCD_NETWORK_CA_FILE).toString();
			} else {
				const caFile = conf.caFile && typeof conf.caFile === 'string' && path.resolve(conf.caFile);
				if (isFile(caFile)) {
					conf.ca = fs.readFileSync(caFile);
				}
			}

			// cert file
			const certFile = conf.certFile && typeof conf.certFile === 'string' && path.resolve(conf.certFile);
			if (isFile(certFile)) {
				conf.cert = fs.readFileSync(certFile);
			}

			// key file
			const keyFile = conf.keyFile && typeof conf.keyFile === 'string' && path.resolve(conf.keyFile);
			if (isFile(keyFile)) {
				conf.key = fs.readFileSync(keyFile);
			}

			// configure proxy
			if (conf.url && conf.url.startsWith('https')) {
				conf.proxy = HTTPS_PROXY || APPCD_NETWORK_PROXY || conf.httpsProxy || undefined;
			} else {
				conf.proxy = HTTP_PROXY || APPCD_NETWORK_PROXY || conf.httpProxy || undefined;
			}

			// remove unused props
			delete conf.caFile;
			delete conf.certFile;
			delete conf.keyFile;
			delete conf.httpProxy;
			delete conf.httpsProxy;

			if (APPCD_NETWORK_STRICT_SSL !== undefined && APPCD_NETWORK_STRICT_SSL !== 'false') {
				conf.strictSSL = true;
			}

			// console.log(conf);

			const req = _request(conf, callback)
				.on('response', response => {
					const { headers, statusCode } = response;
					logger.log(
						'%s %s %s %s',
						note(conf.method),
						conf.url,
						statusCode < 400 ? ok(statusCode) : alert(statusCode),
						Object.prototype.hasOwnProperty.call(headers, 'content-length') ? note(`(${humanize.filesize(headers['content-length'])})`) : ''
					);
				})
				.on('error', () => {});

			resolve(req);
		}));
}
