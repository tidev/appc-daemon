import Agent from 'appcd-agent';
import Dispatcher from 'appcd-dispatcher';
import path from 'path';
import PluginImplBase, { states } from './plugin-impl-base';
import Response, { codes } from 'appcd-response';
import snooplogg from 'snooplogg';
import Tunnel from './tunnel';

import { Readable } from 'stream';

const logger = snooplogg.config({ theme: 'detailed' })(process.connected ? 'appcd:plugin:external:child' : 'appcd:plugin:external:parent');
const { highlight, ok, alert } = snooplogg.styles;

/**
 * External plugin implementation logic.
 */
export default class ExternalPlugin extends PluginImplBase {
	/**
	 * Initializes the plugin and the sandbox global object.
	 *
	 * @param {Plugin} plugin - A reference to the plugin instance.
	 * @access public
	 */
	constructor(plugin) {
		super(plugin);

		this.tunnel = null;

		this.globalObj.appcd.call = (path, data) => {
			if (!this.tunnel) {
				return Promise.reject(new Error('Tunnel not initialized!'));
			}

			return this.tunnel.send({
				path,
				data
			});
		};
	}

	/**
	 * Dispatches a request to the plugin's dispatcher. This is always invoked from the parent
	 * process.
	 *
	 * @param {Object} ctx - A dispatcher context.
	 * @param {Function} next - A function to continue to next dispatcher route.
	 * @returns {Promise}
	 * @access public
	 */
	dispatch(ctx, next) {
		if (!this.tunnel) {
			return next();
		}

		const startTime = new Date;

		logger.log('Sending request: %s', highlight(ctx.path));

		return this.tunnel
			.send(ctx)
			.then(res => {
				const { status } = res;
				const style = status < 400 ? ok : alert;
				let msg = `Plugin dispatcher: ${highlight(`/${this.plugin.name}/${this.plugin.version}${ctx.path}`)} ${style(status)}`;
				if (ctx.type !== 'event') {
					msg += ` ${highlight(`${new Date - startTime}ms`)}`;
				}
				logger.log(msg);

				if (status === 404) {
					return next();
				}

				ctx.status = status;
				ctx.response = res.response;

				return ctx;
			})
			.catch(err => {
				logger.error(err.stack);
				throw err;
			});
	}

	/**
	 * Invokes the parent and child specific logic.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	onStart() {
		return process.connected ? this.startChild() : this.startParent();
	}

	/**
	 * Deactivates the plugin.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	onStop() {
		// send deactivate message which will trigger the child to exit gracefully
		return this.tunnel.send({ type: 'deactivate' });
	}

	/**
	 * Starts the plugin from the child process, wires up the tunnel to the parent, then
	 * activates it.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async startChild() {
		// external plugin running in the plugin host
		this.tunnel = new Tunnel(process, (req, send) => {
			// message from parent process that needs to be dispatched

			logger.log('Received request from parent:');
			logger.log(req);

			if (req.data.type === 'deactivate') {
				return Promise.resolve()
					.then(() => {
						if (this.module && typeof this.module.deactivate === 'function') {
							return this.module.deactivate();
						}
					})
					.then(() => {
						send(new Response(codes.OK));
						process.exit(0);
					});
			}

			logger.log('Dispatching %s', highlight(req.path));

			this.dispatcher
				.call(req.path, req.data)
				.then(({ status, response }) => {
					if (response instanceof Readable) {
						// we have a stream

						// track if this stream is a pubsub stream so we know to send the `fin`
						let pubsub = false;
						let first = true;

						response
							.on('data', message => {
								// data was written to the stream

								if (message.type === 'subscribe') {
									pubsub = true;
								}

								let res;
								const type = message.type || (pubsub ? 'event' : undefined);

								if (typeof message === 'object') {
									res = {
										...message,
										type
									};
								} else {
									res = {
										message,
										type
									};
								}

								send(res);
								first = false;
							})
							.once('end', () => {
								// the stream has ended, if pubsub, send `fin`
								if (pubsub) {
									send({
										type: 'event',
										fin: true
									});
								}
							})
							.once('error', err => {
								logger.error('Response stream error:');
								logger.error(err);
								this.send({ type: 'error', message: err.message || err, status: err.status || 500, fin: true });
							});

					} else if (response instanceof Error) {
						send(response);

					} else {
						send({
							status,
							message: response
						});
					}
				})
				.catch(send);
		});

		// const agent = new Agent();

		await this.activate();

		await this.tunnel.emit({ type: 'activated' });
	}

	/**
	 * Spawns the plugin host and sets up the tunnel.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	startParent() {
		logger.log('Spawning plugin host');

		return Dispatcher
			.call(`/appcd/subprocess/spawn/node/${this.plugin.nodeVersion}`, {
				data: {
					args: [
						path.resolve(__dirname, '..', 'bin', 'appcd-plugin-host'),
						this.plugin.path
					],
					options: {
						env: Object.assign({ FORCE_COLOR: 1 }, process.env)
					},
					ipc: true
				}
			})
			.then(ctx => new Promise((resolve, reject) => {
				this.tunnel = new Tunnel(ctx.proc, (req, send) => {
					if (!req || typeof req !== 'object') {
						return;
					}

					if (req.type === 'log') {
						if (typeof req.message === 'object') {
							snooplogg.dispatch(req.message);
						} else {
							this.logger.log(req.message);
						}
					} else if (req.type === 'activated') {
						logger.log('External plugin is activated');
						resolve();
					} else if (req.id) {
						const startTime = new Date;
						Dispatcher
							.call(req.data.path, req.data.data)
							.then(result => {
								const { status } = result;
								const style = status < 400 ? ok : alert;

								let msg = `Plugin dispatcher: ${highlight(req.data.path || '/')} ${style(status)}`;
								if (ctx.type !== 'event') {
									msg += ` ${highlight(`${new Date - startTime}ms`)}`;
								}
								logger.log(msg);

								send({
									message: result.response,
									status:  result.status
								});
							})
							.catch(send);
					}
				});

				ctx.response
					.on('data', data => {
						switch (data.type) {
							case 'spawn':
								this.pid = data.pid;
								break;

							// case 'stdout':
							// 	logger.log('STDOUT', data.output.trim());
							// 	break;

							// case 'stderr':
							// 	logger.log('STDERR', data.output.trim());
							// 	break;

							case 'exit':
								logger.log('Plugin host exited: %s', highlight(data.code));
								this.tunnel = null;
								this.pid = null;
								this.setState(states.STOPPED);

								if (data.code) {
									// TODO
								}
						}
					});
			}))
			.catch(err => {
				logger.error('Failed to launch plugin host');
				logger.error(err);
				this.setState(states.STOPPED, err);
			});
	}
}
