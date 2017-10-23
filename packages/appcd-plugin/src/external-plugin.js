import Agent from 'appcd-agent';
import appcdLogger from 'appcd-logger';
import Dispatcher, { DispatcherError } from 'appcd-dispatcher';
import path from 'path';
import PluginBase, { states } from './plugin-base';
import PluginError from './plugin-error';
import Response, { AppcdError, codes } from 'appcd-response';
import Tunnel from './tunnel';

import { debounce } from 'appcd-util';
import { FSWatcher } from 'appcd-fswatcher';
import { Readable } from 'stream';

const logger = appcdLogger(process.connected ? 'appcd:plugin:external:child' : 'appcd:plugin:external:parent');
const { alert, highlight, notice, ok } = appcdLogger.styles;

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

		this.globals.appcd.call = (path, data) => {
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
	 * @returns {Promise<Object>}
	 * @access public
	 */
	dispatch(ctx, next) {
		if (!this.tunnel) {
			// this should probably never happen
			return next();
		}

		const startTime = new Date();
		const { path, type } = ctx.request;
		const logRequest = status => {
			const style = status < 400 ? ok : alert;
			let msg = `Plugin dispatcher: ${highlight(`/${this.plugin.name}/${this.plugin.version}${path}`)} ${style(status)}`;
			if (ctx.type !== 'event') {
				msg += ` ${highlight(`${new Date() - startTime}ms`)}`;
			}
			logger.log(msg);
		};

		logger.log('Sending request: %s', highlight(path));

		return this.tunnel
			.send(ctx)
			.then(ctx => {
				logRequest(ctx.status);

				const { sid } = ctx.request;
				if (type === 'subscribe' && sid) {
					this.streams[sid] = ctx.response;
					ctx.response.on('end', () => {
						delete this.streams[sid];
					});
				}

				return ctx;
			})
			.catch(err => {
				if (err.status === 404) {
					logger.log('Plugin did not have handler, passing to next route');
				} else {
					logRequest(err.status);
				}
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
	async onStop() {
		// send deactivate message which will trigger the child to exit gracefully
		await this.tunnel.send({ type: 'deactivate' });
	}

	/**
	 * Cleans up the plugin before it's deactivated.
	 */
	deactivate() {
		// stop all filesystem watchers
		const dirs = Object.keys(this.watchers);
		if (dirs.length) {
			logger.log(appcdLogger.pluralize(`Closing ${dirs.length} fs watcher`, dirs.length));
			for (const dir of dirs) {
				this.watchers[dir].close();
				delete this.watchers[dir];
			}
		} else {
			logger.log('No open fs watchers');
		}
	}

	/**
	 * Starts the plugin from the child process, wires up the tunnel to the parent, then
	 * activates it.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	startChild() {
		// we need to override the global root dispatcher instance so that we can redirect all calls
		// back to the parent process
		logger.log('Patching root dispatcher');
		const rootDispatcher = Dispatcher.root;
		const origCall = rootDispatcher.call;
		rootDispatcher.call = (path, payload) => {
			return origCall.call(rootDispatcher, path, payload)
				.catch(err => {
					if (err instanceof DispatcherError && err.statusCode === 404) {
						logger.log(`No route for ${highlight(path)} in child process, forwarding to parent process`);
						return this.globals.appcd.call(path, payload);
					}
					throw err;
				});
		};

		// external plugin running in the plugin host
		this.tunnel = new Tunnel(process, (req, send) => {
			// message from parent process that needs to be dispatched

			logger.log('Received request from parent:');
			logger.log(req);

			if (req.message.type === 'deactivate') {
				return Promise.resolve()
					.then(async () => {
						if (this.configSubscriptionId) {
							try {
								await this.globals.appcd.call('/appcd/config', {
									sid: this.configSubscriptionId,
									type: 'unsubscribe'
								});
							} catch (err) {
								logger.warn('Failed to unsubscribe from config');
								logger.warn(err);
							}
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
				.catch(err => send(err instanceof AppcdError ? err : new AppcdError(err)));
		});

		this.agent = new Agent()
			.on('stats', stats => {
				// ship stats to parent process
				this.tunnel.emit({ type: 'stats', stats });
			})
			.start();

		return this.globals.appcd
			.call('/appcd/config', { type: 'subscribe' })
			.then(({ response }) => new Promise(resolve => {
				let initialized = false;
				response.on('data', response => {
					if (response.type === 'event') {
						this.config = response.message;
						this.configSubscriptionId = response.sid;

						if (this.config.server && this.config.server.agentPollInterval) {
							this.agent.pollInterval = Math.max(1000, this.config.server.agentPollInterval);
						}

						if (!initialized) {
							initialized = true;
							resolve();
						}
					}
				});
			}), err => {
				this.logger.warn('Failed to subscribe to config');
				this.logger.warn(err);
			})
			.then(() => this.activate())
			.then(() => this.tunnel.emit({ type: 'activated' }))
			.catch(err => {
				this.logger.error(err);

				this.tunnel.emit({
					message: err.message,
					stack:   err.stack,
					type:    'activation_error'
				});

				process.exit(6);
			});
	}

	/**
	 * Spawns the plugin host and sets up the tunnel.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	startParent() {
		logger.log('Spawning plugin host');

		const args = [
			path.resolve(__dirname, '..', 'bin', 'appcd-plugin-host'),
			this.plugin.path
		];

		const debuggerRegExp = /^Debugger listening on .+\/([A-Za-z0-9-]+)$/;
		const debugPort = process.env.INSPECT_PLUGIN_PORT && Math.max(parseInt(process.env.INSPECT_PLUGIN_PORT), 1024) || 9230;
		let debugEnabled = process.env.INSPECT_PLUGIN === this.plugin.name;
		if (debugEnabled) {
			args.unshift(`--inspect-brk=${debugPort}`);
		}

		const onFilesystemChange = debounce(() => {
			logger.log('Detected change in plugin source file, stopping external plugin: %s', highlight(this.plugin.toString()));
			this.stop()
				.then(() => {
					// reset the plugin error state
					logger.log('Reseting error state');
					this.info.error = null;
				})
				.catch(err => {
					logger.error('Failed to restart %s plugin: %s', highlight(this.plugin.toString()), err);
				});
		}, 2000);

		return Dispatcher.call('/appcd/config/plugins/autoReload')
			.then(ctx => ctx.response, () => true)
			.then(autoReload => {
				if (autoReload) {
					const { directories } = this.plugin;
					if (directories.size) {
						logger.log('Watching plugin source directories for changes...');
						for (const dir of directories) {
							if (this.watchers[dir]) {
								logger.log('Already watching plugin directory %s', highlight(dir));
							} else {
								this.watchers[dir] = new FSWatcher(dir)
									.on('change', onFilesystemChange);
							}
						}
					}
				}
			})
			.catch(err => {
				logger.warn('Failed to wire up %s fs watcher: %s', this.plugin.toString(), err.message);
			})
			.then(() => {
				return Dispatcher
					.call(`/appcd/subprocess/spawn/node/${this.plugin.nodeVersion}`, {
						data: {
							args,
							options: {
								env: Object.assign({ FORCE_COLOR: 1 }, process.env)
							},
							ipc: true
						}
					});
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
							this.info.stack = req.stack;
							break;

						case 'log':
							// we need to override the id from the child's log message
							req.message.id = appcdLogger._id;
							appcdLogger.dispatch(req.message);
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

						case 'request':
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
														logger.log('Detected new subscription: %s', highlight(sid));
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
													send({
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
								this.info.stats = null;
								break;

							// case 'stdout':
							// 	data.output.trim().split('\n').forEach(line => {
							// 		logger.log('STDOUT', line);
							// 	});
							// 	break;

							case 'stderr':
								if (debugEnabled) {
									data.output.trim().split('\n').some(line => {
										const m = line.match(debuggerRegExp);
										if (m) {
											logger.log(`${this.plugin.toString()} ready to debug`);
											logger.log(notice(`chrome-devtools://devtools/bundled/inspector.html?experiments=true&v8only=true&ws=localhost:${debugPort}/${m[1]}`));

											// we don't need to output any more
											debugEnabled = false;
											return true;
										}
										return false;
									});
								}
								break;

							case 'exit':
								logger.log('Plugin host exited: %s', highlight(data.code));
								this.tunnel = null;
								this.info.pid = null;
								let err;

								// close any open response streams (i.e. subscriptions)
								const sids = Object.keys(this.streams);
								if (sids.length) {
									logger.log(appcdLogger.pluralize('orphaned stream', sids.length, true));
									for (const sid of sids) {
										try {
											this.streams[sid].end();
										} catch (e) {
											// squeltch
										}
										delete this.streams[sid];
									}
								} else {
									logger.log('No orphan streams');
								}

								if (data.code) {
									this.info.exitCode = data.code;
									if (this.info.state === states.STARTING) {
										if (!this.info.error) {
											this.info.error = `Failed to activate plugin (code ${data.code})`;
										}
										err = new PluginError(this.info.error);
										if (this.info.stack) {
											err.stack = this.info.stack;
										}
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
