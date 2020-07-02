import Agent from 'appcd-agent';
import appcdLogger from 'appcd-logger';
import Dispatcher, { DispatcherContext, DispatcherError } from 'appcd-dispatcher';
import FSWatcher from 'appcd-fswatcher';
import gawk from 'gawk';
import path from 'path';
import PluginBase, { states } from './plugin-base';
import PluginError from './plugin-error';
import Response, { AppcdError, codes } from 'appcd-response';
import Tunnel from './tunnel';

import { debounce } from 'appcd-util';
import { PassThrough, Readable } from 'stream';

const { alert, highlight, note, notice, ok } = appcdLogger.styles;

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

		/**
		 * The external plugin debug logger used by both the parent and child processes.
		 * @type {SnoopLogg}
		 */
		this.appcdLogger = appcdLogger(`appcd:plugin:external:${this.plugin.isParent ? 'parent' : 'child'}`);
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
	async dispatch(ctx, next) {
		if (!this.tunnel) {
			// this should probably never happen
			return await next();
		}

		const startTime = new Date();
		this.appcdLogger.log('Sending request: %s', highlight(ctx.path));

		try {
			ctx = await this.tunnel.send(ctx);
			this.logRequest({ ctx, startTime });

			// if the request is a subscription, and thus response is a stream, then listen for
			// the end event so we can unsubscribe the child side
			const { sid } = ctx.request;
			if (sid && ctx.response instanceof Readable) {
				this.streams[sid] = ctx.response;
				ctx.response.on('end', () => {
					if (this.streams[sid]) {
						// If we still have a response stream reference at this point
						// the response was not ended by an "unsubscribe" request. Issue
						// one manually to properly clean up subscriptions.
						this.tunnel.send({
							type: 'unsubscribe',
							sid,
							path: `/${ctx.request.params.path}`,
							params: ctx.request.params
						});
						delete this.streams[sid];
					}
				});
			}

			return ctx;
		} catch (err) {
			if (err instanceof DispatcherError && err.status === 404) {
				this.appcdLogger.log('Plugin did not have handler, passing to next route');
			} else {
				this.logRequest({ ctx, startTime });
			}
			throw err;
		}
	}

	/**
	 * Invokes the parent and child specific logic.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	onStart() {
		return this.plugin.isParent ? this.startParent() : this.startChild();
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
	 * Cleans up the plugin before it's deactivated.
	 */
	deactivate() {
		// stop all filesystem watchers
		const dirs = Object.keys(this.watchers);
		if (dirs.length) {
			this.appcdLogger.log(`Closing ${dirs.length} fs watcher${dirs.length !== 1 ? 's' : ''}`);
			for (const dir of dirs) {
				this.watchers[dir].close();
				delete this.watchers[dir];
			}
		} else {
			this.appcdLogger.log('No open fs watchers');
		}
	}

	/**
	 * Starts the plugin from the child process, wires up the tunnel to the parent, then
	 * activates it.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async startChild() {
		// we need to override the global root dispatcher instance so that we can redirect all calls
		// back to the parent process
		this.appcdLogger.log('Patching root dispatcher');
		const rootDispatcher = Dispatcher.root = this.dispatcher;
		const origCall = rootDispatcher.call;
		rootDispatcher.call = async (path, payload) => {
			try {
				return await origCall.call(rootDispatcher, path, payload);
			} catch (err) {
				// if the call originates from the plugin and the route is not found, then forward
				// it to the parent process.
				//
				// if the call is from the parent and the route is not found, then return a 404.
				if ((!(payload instanceof DispatcherContext) || payload.origin !== 'parent') && err instanceof DispatcherError && err.statusCode === 404) {
					this.appcdLogger.log(`No route for ${highlight(path)} in child process, forwarding to parent process`);

					if (!this.tunnel) {
						throw new Error('Tunnel not initialized!');
					}

					return this.tunnel.send({
						path,
						data: payload
					});
				}

				throw err;
			}
		};

		const cancelConfigSubscription = async () => {
			const sid = this.configSubscriptionId;
			if (sid) {
				this.configSubscriptionId = null;
				try {
					await this.globals.appcd.call('/appcd/config', {
						sid,
						type: 'unsubscribe'
					});
				} catch (err) {
					this.appcdLogger.warn('Failed to unsubscribe from config');
					this.appcdLogger.warn(err);
				}
			}
		};

		// external plugin running in the plugin host
		this.tunnel = new Tunnel(process, false, async (req, send) => {
			// message from parent process that needs to be dispatched

			this.appcdLogger.log('Received request from parent:');
			this.appcdLogger.log(req);

			if (req.message.request.type === 'deactivate') {
				try {
					await cancelConfigSubscription();
					if (this.module && typeof this.module.deactivate === 'function') {
						await this.module.deactivate();
					}
					send(new Response(codes.OK));
				} catch (err) {
					send(err);
				} finally {
					process.exit(0);
				}
			}

			if (req.message.request.type === 'health') {
				if (this.agent) {
					return send({
						message: {
							pid:   process.pid,
							title: process.title,
							desc:  this.plugin.toString(),
							...this.agent.health()
						},
						status: codes.OK
					});
				}
				return send({
					message: null,
					status: codes.SERVER_ERROR
				});
			}

			try {
				this.appcdLogger.log('Dispatching %s', highlight(req.message.path), req.message.request);
				const { status, response } = await this.dispatcher.call(req.message.path, new DispatcherContext({
					headers:  req.message.headers,
					origin:   'parent',
					request:  req.message.request,
					response: new PassThrough({ objectMode: true }),
					source:   req.message.source
				}));

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

							let data;
							const type = message.type || (sid ? 'event' : undefined);

							if (message instanceof Error) {
								data = {
									message:    message.message || message.toString(),
									stack:      message.stack,
									status:     message.status || 500,
									statusCode: message.statusCode || '500',
									type:       'error'
								};
							} else if (typeof message === 'object') {
								data = {
									...message,
									type
								};
							} else {
								data = {
									message,
									type
								};
							}

							if (data.message instanceof Response) {
								data = {
									...data,
									status: data.message.status || codes.OK,
									message: data.message.toString()
								};
							}

							send({
								type: 'stream',
								data
							});
						})
						.once('end', () => send({
							type: 'stream',
							data: {
								sid,
								type: 'fin'
							}
						}))
						.once('error', err => {
							this.appcdLogger.error('Response stream error:');
							this.appcdLogger.error(err);
							send({
								type: 'stream',
								data: {
									message: err.message || err,
									stack: err.stack,
									status: err.status || 500,
									type: 'error'
								}
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
			} catch (err) {
				send(err instanceof AppcdError ? err : new AppcdError(err));
			}
		});

		await this.init();

		this.agent = new Agent({ pollInterval: Math.max(1000, this.config.server?.agentPollInterval || 0) })
			.on('stats', stats => this.tunnel.emit({ type: 'stats', stats }))
			.start();

		gawk.watch(this.config, [ 'server', 'agentPollInterval' ], () => {
			this.agent.pollInterval = Math.max(1000, this.config.server?.agentPollInterval || 0);
		});

		try {
			await this.activate();
			await this.tunnel.emit({
				type: 'activated',
				services: this.info.services
			});
		} catch (err) {
			this.appcdLogger.error(err);

			await cancelConfigSubscription();

			this.tunnel.emit({
				message: err.message,
				stack:   err.stack,
				type:    'activation_error'
			});

			process.exit(6);
		}
	}

	/**
	 * Spawns the plugin host and sets up the tunnel.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async startParent() {
		const args = [
			path.resolve(__dirname, '..', 'bin', 'appcd-plugin-host'),
			this.plugin.path
		];

		const debuggerRegExp = /^Debugger listening on .+\/([A-Za-z0-9-]+)$/;
		const debugPort = process.env.APPCD_INSPECT_PLUGIN_PORT && Math.max(parseInt(process.env.APPCD_INSPECT_PLUGIN_PORT), 1024) || 9230;
		let debugEnabled = process.env.APPCD_INSPECT_PLUGIN === this.plugin.name;
		if (debugEnabled) {
			args.unshift(`--inspect-brk=${debugPort}`);
		}

		await this.init();

		if (this.config.plugins?.autoReload !== false) {
			try {
				const { directories, path: pluginPath } = this.plugin;
				if (directories.size) {
					const subjects = new Set(directories);

					// we only want to watch this directory if it's the plugin root or the top-most
					// path of common paths
					for (const dir of directories) {
						let p = dir;
						while (p !== pluginPath) {
							p = path.dirname(p);
							if (subjects.has(p) && p !== pluginPath) {
								subjects.delete(dir);
								break;
							}
						}
					}

					const dirsToWatch = [];
					for (const dir of subjects) {
						dirsToWatch.push({
							dir,
							recursive: dir !== pluginPath && dir.startsWith(pluginPath)
						});
					}

					this.appcdLogger.log('Watching plugin source directories for changes:');
					for (const { dir, recursive } of dirsToWatch) {
						this.appcdLogger.log(highlight(`  ${dir}${recursive ? '/**' : ''}`));
					}

					const onFilesystemChange = debounce(async () => {
						try {
							this.appcdLogger.log('Detected change in plugin source file, stopping external plugin: %s', highlight(this.plugin.toString()));
							await this.stop();

							const wasErrored = !!this.info.error;

							// reset the plugin error state
							this.appcdLogger.log('Reseting error state');
							this.info.error = null;
							this.info.stack = null;

							if (this.info.autoStart) {
								if (wasErrored) {
									this.appcdLogger.warn(`Skipping auto starting ${highlight(`${this.plugin.name}@${this.plugin.version}`)} since plugin stopped due to error`);
								} else {
									this.appcdLogger.log(`Auto starting ${highlight(`${this.plugin.name}@${this.plugin.version}`)}`);
									await this.start();
								}
							}
						} catch (err) {
							this.appcdLogger.error('Failed to restart %s plugin: %s', highlight(this.plugin.toString()), err);
						}
					}, 2000);

					for (const { dir, recursive } of dirsToWatch) {
						this.watchers[dir] = new FSWatcher(dir, { recursive })
							.on('change', evt => {
								if (!this.plugin.ignore.ignores(path.relative(pluginPath, evt.file))) {
									onFilesystemChange();
								}
							});
					}
				}
			} catch (err) {
				this.appcdLogger.warn('Failed to wire up %s auto reload fs watcher: %s', this.plugin.toString(), err.message);
			}
		}

		try {
			this.appcdLogger.log('Spawning plugin host');
			const ctx = await Dispatcher.call(`/appcd/subprocess/spawn/node/${this.plugin.nodeVersion}`, {
				data: {
					args,
					options: {
						env: { FORCE_COLOR: 1, ...process.env },
						cwd: this.plugin.path
					},
					ipc: true
				}
			});

			await new Promise((resolve, reject) => {
				// create the tunnel to the child process (e.g. the plugin host)
				this.tunnel = new Tunnel(ctx.proc, true, async (req, send) => {
					switch (req.type) {
						case 'activated':
							this.appcdLogger.log(`External plugin is activated with ${req.services.length ? 'the following services:' : 'no services'}`);
							for (const svc of req.services) {
								this.appcdLogger.log(`  ${highlight(svc)}`);
							}
							this.info.services = req.services;
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
								const stream = this.streams[req.sid];
								delete this.streams[req.sid];
								stream.end();
							}
							break;

						case 'request':
						default:
							if (!req.id) {
								break;
							}

							// dispatcher request
							try {
								const startTime = new Date();
								const { status, response } = await Dispatcher.call(req.message.path, new DispatcherContext({
									headers:  req.message.headers,
									request:  req.message.request,
									response: new PassThrough({ objectMode: true }),
									source:   req.message.source
								}));
								const style = status < 400 ? ok : alert;

								let msg = `Plugin dispatcher: ${highlight(req.message.path || '/')} ${style(status)}`;
								if (ctx.type !== 'event') {
									msg += ` ${highlight(`${new Date() - startTime}ms`)}`;
								}
								this.appcdLogger.log(msg);

								if (response instanceof Readable) {
									// we have a stream

									const { data } = req.message.request;
									this.appcdLogger.log(`${highlight(req.message.path)} ${data && Array.isArray(data.args) && note(data.args.join(' ')) || ''} returned a streamed response`);

									// track if this stream is a pubsub stream so we know to send the `fin`
									let sid;

									response
										.on('data', message => {
											// data was written to the stream

											if (message.type === 'subscribe') {
												sid = message.sid;
												this.appcdLogger.log('Detected new subscription: %s', highlight(sid));
												this.streams[sid] = response;
											}

											this.appcdLogger.log(`Streamed data chunk: ${highlight(message.type || 'unknown type')}`);

											send({
												type: 'stream',
												data: message
											});
										})
										.once('end', () => {
											delete this.streams[sid];

											// the stream has ended, send `fin`
											send({
												type: 'stream',
												data: {
													sid,
													type: 'fin'
												}
											});
										})
										.once('error', err => {
											delete this.streams[sid];

											this.appcdLogger.error('Response stream error:');
											this.appcdLogger.error(err);

											send({
												type: 'stream',
												data: {
													message: err.message || err,
													stack: err.stack,
													status: err.status || 500,
													type: 'error'
												}
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
							} catch (err) {
								send({
									...err,
									message: err.message || err,
									stack: err.stack,
									status: err.status || 500,
									type: 'error'
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
								// 		this.appcdLogger.log('STDOUT', line);
								// 	});
								// 	break;

							case 'stderr':
								if (debugEnabled) {
									data.output.trim().split('\n').some(line => {
										const m = line.match(debuggerRegExp);
										if (m) {
											this.appcdLogger.log(`${this.plugin.toString()} ready to debug`);
											this.appcdLogger.log(notice(`chrome-devtools://devtools/bundled/inspector.html?experiments=true&v8only=true&ws=localhost:${debugPort}/${m[1]}`));

											// we don't need to output any more
											debugEnabled = false;
											return true;
										}
										return false;
									});
								}
								break;

							case 'exit':
								this.appcdLogger.log('Plugin host %s exited: %s', this.info.pid, highlight(data.code));
								this.tunnel = null;
								this.info.pid = null;
								this.info.exitCode = data.code || 0;
								let err;

								// close any open response streams (i.e. subscriptions)
								const sids = Object.keys(this.streams);
								if (sids.length) {
									this.appcdLogger.log(`${sids.length} orphaned stream${sids.length !== 1 ? 's' : ''}`);
									for (const sid of sids) {
										try {
											this.streams[sid].end();
										} catch (e) {
											// squelch
										}
										delete this.streams[sid];
									}
								} else {
									this.appcdLogger.log('No orphan streams');
								}

								if (this.info.state === states.STARTING) {
									this.appcdLogger.log('Plugin has not finished activating yet');

									if (!this.info.error) {
										if (this.info.exitCode === 0) {
											this.info.error = 'Plugin stopped while starting';
										} else {
											this.info.error = `Failed to activate plugin (code ${data.code})`;
										}
									}

									err = new PluginError(this.info.error);
									if (this.info.stack) {
										err.stack = this.info.stack;
									}
									reject(err);
								}

								this.setState(states.STOPPED, err);
						}
					});
			});
		} catch (err) {
			this.appcdLogger.error('Failed to activate plugin: %s', highlight(this.plugin.toString()));
			this.setState(states.STOPPED, err);
			throw err;
		}
	}

	/**
	 * Returns a snapshot of the external plugin's health from the agent.
	 *
	 * @returns {Promise<Object>}
	 */
	async health() {
		if (this.info.pid && this.tunnel) {
			const { response } = await this.tunnel.send({
				type: 'health'
			});
			return response;
		}
	}
}
