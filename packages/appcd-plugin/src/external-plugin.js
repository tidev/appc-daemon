import Agent from 'appcd-agent';
import Dispatcher, { DispatcherContext } from 'appcd-dispatcher';
import path from 'path';
import PluginImplBase, { states } from './plugin-impl-base';
import Response, { codes } from 'appcd-response';
import snooplogg from 'snooplogg';
import Tunnel from './tunnel';
import uuid from 'uuid';

import { debounce } from 'appcd-util';
import { FSWatcher } from 'appcd-fswatcher';
import { Readable } from 'stream';

const snooplogger = snooplogg.config({ theme: 'detailed' });
const logger = snooplogger(process.connected ? 'appcd:plugin:external:child' : 'appcd:plugin:external:parent');
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

		/**
		 * A map of stream ids to streams.
		 * @type {Object}
		 */
		this.streams = {};

		/**
		 * The tunnel instance that connects to the parent/child process.
		 * @type {Tunnel}
		 */
		this.tunnel = null;

		/**
		 * The file system watcher for this scheme's path.
		 * @type {Object}
		 */
		this.watchers = {};

		this.onFilesystemChange = debounce(() => {
			logger.log('Restarting external plugin: %s', highlight(this.plugin.toString()));
			Promise.resolve()
				.then(() => this.stop())
				.then(() => this.start())
				.catch(err => {
					logger.error('Failed to restart %s plugin: %s', highlight(this.plugin.toString()), err);
				});
		});

		this.globalObj.appcd.call = (path, data) => {
			if (!this.tunnel) {
				return Promise.reject(new Error('Tunnel not initialized!'));
			}

			return this.tunnel
				.send({
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
			.send({
				path: ctx.path,
				data: ctx.request
			})
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

			if (req.message.type === 'deactivate') {
				return Promise.resolve()
					.then(() => {
						if (this.configSubscriptionId) {
							return this.globalObj.appcd
								.call('/appcd/config', {
									sid: this.configSubscriptionId,
									type: 'unsubscribe'
								});
						}
					})
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

			logger.log('Dispatching %s', highlight(req.message.path));

			this.dispatcher
				.call(req.message.path, req.message.data)
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

		this.agent = new Agent()
			.on('stats', stats => {
				// ship stats to parent process
				this.tunnel.emit({ type: 'stats', stats });
			})
			.start();

		this.globalObj.appcd
			.call('/appcd/config', { type: 'subscribe' })
			.then(({ response, status }) => {
				response.on('data', response => {
					if (response.type === 'event') {
						this.config = response.message;
						this.configSubscriptionId = response.sid;

						if (this.config.server && this.config.server.agentPollInterval) {
							this.agent.pollInterval = Math.max(1000, this.config.server.agentPollInterval);
						}
					}
				});
			})
			.catch(err => {
				this.logger.warn('Failed to get config!');
				this.logger.warn(err);
			});

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
					if (req.type === 'log') {
						if (typeof req.message === 'object') {
							req.message.id = snooplogger._id;
							snooplogg.dispatch(req.message);
						} else {
							this.logger.log(req.message);
						}
					} else if (req.type === 'activated') {
						logger.log('External plugin is activated');
						resolve();
					} else if (req.type === 'unsubscribe') {
						if (this.streams[req.sid]) {
							this.streams[req.sid].end();
							delete this.streams[req.sid];
						}
					} else if (req.type === 'stats') {
						this.info.stats = req.stats;
					} else if (req.id) {
						const startTime = new Date;

						Dispatcher
							.call(req.message.path, req.message.data)
							.then(({ status, response }) => {
								const style = status < 400 ? ok : alert;

								let msg = `Plugin dispatcher: ${highlight(req.message.path || '/')} ${style(status)}`;
								if (ctx.type !== 'event') {
									msg += ` ${highlight(`${new Date - startTime}ms`)}`;
								}
								logger.log(msg);

								if (response instanceof Readable) {
									// we have a stream

									// track if this stream is a pubsub stream so we know to send the `fin`
									let pubsub = false;
									let first = true;
									let sid;

									response
										.on('data', message => {
											// data was written to the stream

											if (message.type === 'subscribe') {
												pubsub = true;
												sid = message.sid;
												this.streams[sid] = response;
											}

											send(message);
											first = false;
										})
										.once('end', () => {
											delete this.streams[sid];

											// the stream has ended, if pubsub, send `fin`
											if (pubsub) {
												send({
													sid,
													type: 'event',
													fin: true
												});
											}
										})
										.once('error', err => {
											delete this.streams[sid];

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
					}
				});

				ctx.response
					.on('data', data => {
						switch (data.type) {
							case 'spawn':
								this.info.pid = data.pid;
								this.info.exitCode = null;

								for (const dir of this.plugin.directories) {
									this.watchers[dir] = new FSWatcher(dir)
										.on('change', () => this.onFilesystemChange());
								}

								break;

							case 'stdout':
								logger.log('STDOUT', data.output.trim());
								break;

							case 'stderr':
								logger.log('STDERR', data.output.trim());
								break;

							case 'exit':
								logger.log('Plugin host exited: %s', highlight(data.code));
								this.tunnel = null;
								this.info.pid = null;
								this.setState(states.STOPPED);

								if (this.watchers) {
									for (const dir of Object.keys(this.watchers)) {
										this.watchers[dir].close();
										delete this.watchers[dir];
									}
									this.watchers = {};
								}

								if (data.code) {
									this.info.exitCode = data.code;
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
