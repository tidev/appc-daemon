import PluginContainer from './plugin-container';
import PluginError from './plugin-error';
import Response, { AppcdError, codes } from 'appcd-response';
import snooplogg from 'snooplogg';
import Stream from 'stream';

const logger = snooplogg.stdio.config({ theme: 'detailed' })('appcd:plugin:host');

let container = null;

process
	.on('uncaughtException', err => snooplogg.error('Caught exception:', err))
	.on('unhandledRejection', (reason, p) => snooplogg.error('Unhandled Rejection at: Promise ', p, reason))
	.on('message', msg => {
		console.log('GOT MESSAGE');
		console.log(msg);

		if (!msg.id) {
			// no id, no service
			return;
		}

		Promise
			.resolve()
			.then(() => {
				if (msg.type === 'init') {
					if (container) {
						throw new PluginError(codes.BAD_REQUEST, 'Plugin host already initialized');
					}

					container = new PluginContainer(msg.data || {});
					return {
						response: new Response(codes.OK)
					};
				}

				if (!container) {
					throw new PluginError(codes.BAD_REQUEST, 'Plugin host not initialized');
				}

				return container.dispatch(msg);
			})
			.then(result => {
				if (!result) {
					// no response
					return;
				}

				if (result.response instanceof Response) {
					return {
						status: result.status || codes.OK,
						message: result.response.toString()
					};
				}

				if (result.response instanceof Stream) {
					return new Promise((resolve, reject) => {
						let message = '';
						result
							.on('data', data => {
								message += data.toString();
							})
							.once('end', () => {
								resolve({
									status: result.status || codes.OK,
									message
								});
							})
							.once('error', reject);
					});
				}

				return {
					status: result.status || codes.OK,
					message: result.response
				};
			})
			.then(response => {
				if (response) {
					response.id = msg.id;
					process.send(response);
				}
			})
			.catch(err => {
				logger.error(err);
				process.send({
					id: msg.id,
					status: err instanceof AppcdError && err.status || codes.SERVER_ERROR,
					message: err.toString()
				});
			});
	});
