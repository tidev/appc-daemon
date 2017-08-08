import Agent from 'appcd-agent';
import Dispatcher from 'appcd-dispatcher';
import path from 'path';
import PluginBase, { states } from './plugin-base';
import PluginError from './plugin-error';
import Response, { AppcdError, codes } from 'appcd-response';
import snooplogg from 'snooplogg';
import Tunnel from './tunnel';

import { debounce } from 'appcd-util';
import { FSWatcher } from 'appcd-fswatcher';
import { Readable } from 'stream';

const logger = snooplogg.config({ theme: 'detailed' })(process.connected ? 'appcd:plugin:external:child' : 'appcd:plugin:external:parent');
const { highlight, ok, alert } = snooplogg.styles;

/**
 * External plugin implementation logic.
 */
export default class ExternalPlugin extends PluginBase {
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

		this.globals.appcd.call = (path, data) => {
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

		const startTime = new Date();

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
					msg += ` ${highlight(`${new Date() - startTime}ms`)}`;
				}
				logger.log(msg);

				if (status === 404) {
					return next();
				}

				ctx.status = status;
				ctx.response = res.response;

				return ctx;
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
							return this.globals.appcd
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

			logger.log('Dispatching %s', highlight(req.message.path), req.message.data);

			this.dispatcher
				.call(req.message.path, req.message.data)
				.then(({ status, response }) => {
					if (response instanceof Readable) {
						// we have a stream

						// track if this stream is a pubsub stream so we know to send the `fin`
						let sid;

						response
							.on('data', message => {
								// data was written to the stream

								if (message.type === 'subscribe') {
									sid = message.sid;
								}

								let res;
								const type = message.type || (sid ? 'event' : undefined);

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
							})
							.once('end', () => {
								// the stream has ended, if sid, send `fin`
								if (sid) {
									send({
										sid,
										type: 'fin',
									});

								}
							})
							.once('error', err => {
								logger.error('Response stream error:');
								logger.error(err);
								this.send({
									message: err.message || err,
									stack: err.stack,
									status: err.status || 500,
									type: 'error'
								});
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
				.catch(err => send(new AppcdError(err)));
		});

		this.agent = new Agent()
			.on('stats', stats => {
				// ship stats to parent process
				this.tunnel.emit({ type: 'stats', stats });
			})
			.start();

		this.globals.appcd
			.call('/appcd/config', { type: 'subscribe' })
			.then(({ response }) => {
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

		try {
			await this.activate();
		} catch (err) {
			this.logger.error(err);

			this.tunnel.emit({
				message: err.message,
				type:    'activation_error'
			});

			process.exit(6);
		}

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
					switch (req.type) {
						case 'activated':
							logger.log('External plugin is activated');
							resolve();
							break;

						case 'activation_error':
							this.info.error = req.message;
							break;

						case 'log':
							req.message.id = snooplogg._id;
							snooplogg.dispatch(req.message);
							break;

						case 'stats':
							this.info.stats = req.stats;
							break;

						case 'unsubscribe':
							if (this.streams[req.sid]) {
								this.streams[req.sid].end();
								delete this.streams[req.sid];
							}
							break;

						default:
							if (req.id) {
								// dispatcher request
								const startTime = new Date();

								Dispatcher
									.call(req.message.path, req.message.data)
									.then(({ status, response }) => {
										const style = status < 400 ? ok : alert;

										let msg = `Plugin dispatcher: ${highlight(req.message.path || '/')} ${style(status)}`;
										if (ctx.type !== 'event') {
											msg += ` ${highlight(`${new Date() - startTime}ms`)}`;
										}
										logger.log(msg);

										if (response instanceof Readable) {
											// we have a stream

											// track if this stream is a pubsub stream so we know to send the `fin`
											let sid;

											response
												.on('data', message => {
													// data was written to the stream

													if (message.type === 'subscribe') {
														sid = message.sid;
														this.streams[sid] = response;
													}

													send(message);
												})
												.once('end', () => {
													delete this.streams[sid];

													// the stream has ended, if sid, send `fin`
													if (sid) {
														send({
															sid,
															type: 'fin'
														});
													}
												})
												.once('error', err => {
													delete this.streams[sid];

													logger.error('Response stream error:');
													logger.error(err);
													this.send({
														message: err.message || err,
														stack: err.stack,
														status: err.status || 500,
														type: 'error'
													});
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
									.catch(err => {
										send({
											message: err.message || err,
											stack: err.stack,
											status: err.status || 500,
											type: 'error'
										});
									});
							}
					}
				});

				ctx.response
					.on('data', data => {
						switch (data.type) {
							case 'spawn':
								this.info.pid = data.pid;
								this.info.exitCode = null;

								Dispatcher.call('/appcd/config/plugin/autoReload')
									.then(ctx => ctx.response, () => true)
									.then(autoReload => {
										if (autoReload) {
											for (const dir of this.plugin.directories) {
												this.watchers[dir] = new FSWatcher(dir)
													.on('change', () => this.onFilesystemChange());
											}
										}
									})
									.catch(err => {
										logger.warn('Failed to wire up %s fs watcher: %s', this.plugin.toString(), err.message);
									});

								break;

							// case 'stdout':
							// 	data.output.trim().split('\n').forEach(line => {
							// 		logger.log('STDOUT', line);
							// 	});
							// 	break;

							// case 'stderr':
							// 	data.output.trim().split('\n').forEach(line => {
							// 		logger.log('STDERR', line);
							// 	});
							// 	break;

							case 'exit':
								logger.log('Plugin host exited: %s', highlight(data.code));
								this.tunnel = null;
								this.info.pid = null;
								const { state } = this.info;

								if (this.watchers) {
									for (const dir of Object.keys(this.watchers)) {
										this.watchers[dir].close();
										delete this.watchers[dir];
									}
									this.watchers = {};
								}

								let err;

								if (data.code) {
									this.info.exitCode = data.code;
									if (state === states.STARTING) {
										if (!this.info.error) {
											this.info.error = `Failed to activate plugin (code ${data.code})`;
										}
										err = new PluginError(this.info.error);
										reject(err);
									}
								}

								this.setState(states.STOPPED, err);
						}
					});
			}))
			.catch(err => {
				logger.error('Failed to activate plugin: %s', highlight(this.plugin.toString()));
				this.setState(states.STOPPED, err);
				throw err;
			});
	}
}
