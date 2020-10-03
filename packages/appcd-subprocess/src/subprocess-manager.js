/* eslint-disable promise/always-return, promise/no-nesting */

import appcdLogger from 'appcd-logger';
import Dispatcher from 'appcd-dispatcher';
import gawk from 'gawk';
import psTree from 'ps-tree';
import Response, { i18n } from 'appcd-response';
import SubprocessError from './subprocess-error';

import { EventEmitter } from 'events';
import { expandPath } from 'appcd-path';
import { prepareNode } from 'appcd-nodejs';
import { sleep } from 'appcd-util';
import { spawn } from './subprocess';

const { __n } = i18n();
const { codes } = SubprocessError;

const logger = appcdLogger('appcd:subprocess:manager');
const { log } = logger;
const { highlight } = appcdLogger.styles;

/**
 * Manages spawned subprocesses through dispatcher handlers.
 */
export default class SubprocessManager extends Dispatcher {
	/**
	 * Creates the `SubprocessManager` and wires up the dispatcher handlers.
	 *
	 * @access public
	 */
	constructor() {
		super();

		const emitter = new EventEmitter();
		this.on = emitter.on.bind(emitter);

		const subprocesses = this.subprocesses = gawk([]);

		this.register('/spawn/node/:version?', async ctx => {
			const networkConfig = await Dispatcher.call('/appcd/config/network').then(ctx => ctx.response).catch(e => {});
			const { data, params } = ctx.request;
			const node = await prepareNode({
				networkConfig,
				nodeHome: expandPath((await Dispatcher.call('/appcd/config/home')).response, 'node'),
				version: params.version || process.version
			});
			return await this.call('/spawn', { data: { ...data, command: node } });
		});

		this.register('/spawn', ctx => new Promise((resolve, reject) => {
			const data = ctx.request.data || {};
			data.options || (data.options = {});

			const { ipc } = data;

			if (ipc) {
				const { stdio } = data && data.options;
				if (typeof stdio === 'string') {
					data.options.stdio = [ stdio, stdio, stdio, 'ipc' ];
				} else if (!Array.isArray(stdio)) {
					data.options.stdio = [ 'pipe', 'pipe', 'pipe', 'ipc' ];
				} else if (stdio.indexOf('ipc') === -1) {
					data.options.stdio = [ 'ignore', 'ignore', 'ignore', 'ipc' ].map((s, i) => stdio[i] || s);
				}
			}

			// if we are on Linux, it's possible to see an ETXTBSY, so we wait 100ms then try
			// again... up to 5 times (0.5 seconds)
			let tries = 5;

			const trySpawn = () => {
				return Promise.resolve()
					.then(() => {
						tries--;
						return spawn(data);
					})
					.catch(async err => {
						if (err.code === 'ETXTBSY' && tries) {
							// this error happens on Linux when the executable was just written
							// and is not ready to be called
							log('Spawn threw ETXTBSY, retrying...');
							await sleep(100);
							await trySpawn();
						} else {
							throw err;
						}
					});
			};

			trySpawn()
				.then(result => {
					const { command, args, options, child } = result;
					const { pid } = child;

					child.once('error', e => reject(new SubprocessError(e)));

					if (!pid) {
						return;
					}

					// create the subprocess descriptor
					const proc = ctx.proc = Object.assign(new EventEmitter(), {
						pid,
						command,
						args,
						options,
						startTime: new Date()
					});

					Object.defineProperties(proc, {
						kill: {
							value: forceTimeout => new Promise((resolve, reject) => {
								let timer;

								// listen for a graceful exit
								proc.on('exit', () => {
									clearTimeout(timer);
									resolve();
								});

								this.kill(pid, 'SIGTERM')
									.then(code => {
										// only need to resolve if the process is not running,
										// otherwise the `once('exit')` call above will resolve it
										if (code === codes.PROCESS_NOT_FOUND) {
											clearTimeout(timer);
											resolve();
										}
									})
									.catch(err => {
										// this error callback will probably never get called since
										// `kill()` will only reject if `process.kill()` fails and
										// since we gracefully handle ESRCH and never pass in an
										// invalid signal, it would take a catostraphic exception
										// for this callback to fire
										clearTimeout(timer);
										reject(err);
									});

								// if we have a `forceTimeout`, wait, then kill the process with a
								// sigkill
								if (forceTimeout && (forceTimeout = Math.max(forceTimeout, 0))) {
									timer = setTimeout(() => {
										this.kill(pid, 'SIGKILL')
											.then(resolve)
											.catch(reject);
									}, forceTimeout);
								}
							})
						},

						send: {
							value: value => {
								if (!ipc) {
									throw new SubprocessError('IPC not enabled for this process');
								}
								child.send(value, () => {});
							}
						}
					});

					// add it to our list of subprocesses
					// note: this will kick off an 'change' event and update any status listeners
					subprocesses.push(proc);

					let writable = true;
					ctx.response.on('end', () => {
						writable = false;

						if (proc.pid && !options.detached) {
							log(`Response stream was closed by other end, killing child process ${highlight(proc.pid)}`);
							try {
								child.kill();
							} catch (err) {
								// squelch
							}
						}
					});

					log('Spawned %s', highlight(pid));
					ctx.response.write({ type: 'spawn', pid });

					// wire up ipc
					if (ipc) {
						child.on('message', msg => {
							proc.emit('message', msg);
							ctx.response.write({ type: 'ipc', msg });
						});
					}

					if (child.stdout) {
						child.stdout.on('data', data => {
							if (writable) {
								ctx.response.write({ type: 'stdout', output: data.toString() });
							}
						});
					}

					if (child.stderr) {
						child.stderr.on('data', data => {
							if (writable) {
								ctx.response.write({ type: 'stderr', output: data.toString() });
							}
						});
					}

					child.once('close', code => {
						log('%s exited (code %s)', highlight(pid), code);

						for (let i = 0, l = subprocesses.length; i < l; i++) {
							if (subprocesses[i].pid === pid) {
								subprocesses.splice(i, 1);
								break;
							}
						}

						// do this after we remove the subprocess from the list
						proc.pid = null;

						if (writable) {
							ctx.response.end({
								type: 'exit',
								code
							});
						}

						proc.emit('exit', code);
					});

					emitter.emit('spawn', proc);

					// we resolve as soon as possible since spawn is async
					resolve();
				})
				.catch(err => reject(new SubprocessError(err)));
		}));

		this.register('/send/:pid?', ctx => {
			const { data, params } = ctx.request;

			if (!params.pid) {
				throw new SubprocessError(codes.MISSING_PARAMETER, 'Missing required parameter "%s"', 'pid');
			}

			const pid = parseInt(params.pid);
			if (isNaN(pid) || pid < 0) {
				throw new SubprocessError(codes.INVALID_PARAMETER, 'The "%s" parameter must be a positive integer', 'pid');
			}

			for (const proc of subprocesses) {
				if (proc.pid === pid) {
					proc.send(data);
					ctx.response = { success: true };
					return;
				}
			}

			throw new SubprocessError(codes.NOT_FOUND, 'Process "%s" not running', 'pid');
		});

		this.register('/kill/:pid?', async ctx => {
			const { data, params } = ctx.request;

			if (!params.pid) {
				throw new SubprocessError(codes.MISSING_PARAMETER, 'Missing required parameter "%s"', 'pid');
			}

			const pid = parseInt(params.pid);
			if (isNaN(pid) || pid < 0) {
				throw new SubprocessError(codes.INVALID_PARAMETER, 'The "%s" parameter must be a positive integer', 'pid');
			}

			let signal = data && data.signal !== undefined ? data.signal : 'SIGTERM';
			if (signal === '0') {
				signal = 0;
			}

			const result = await this.kill(pid, signal);
			ctx.response = new Response(result);
			emitter.emit('kill', pid);
		});

		this.register('/status', ctx => {
			ctx.response = this.subprocesses;
		});

		gawk.watch(this.subprocesses, (subprocesses, src) => {
			emitter.emit('change', subprocesses, src);
			Dispatcher
				.call('/appcd/status', { data: { subprocesses } })
				.catch(err => {
					logger.warn('Failed to update status');
					logger.warn(err);
				});
		});
	}

	/**
	 * Kills a process and its children.
	 *
	 * @param {Number} pid - The process id to kill.
	 * @param {String} [signal] - The signal to send. Defaults to 'SIGTERM'.
	 * @returns {Promise}
	 * @access public
	 */
	kill(pid, signal = 'SIGTERM') {
		return new Promise((resolve, reject) => {
			psTree(pid, (err, children) => {
				let result = codes.OK;

				try {
					log('Killing subprocess %s with %s', highlight(pid), signal);
					process.kill(pid, signal);
				} catch (e) {
					if (e.code === 'ESRCH') {
						// already dead
						log('Subprocess %s appears to already be dead', highlight(pid));
						result = codes.PROCESS_NOT_FOUND;
					} else {
						return reject(new SubprocessError(e));
					}
				}

				if (err) {
					// getting ps-tree to fail isn't easy, but just in case...
					log('Error getting subprocess %s children: %s', highlight(pid), err.toString());
				} else if (children.length) {
					log('Killing subprocess %s children with SIGTERM: %s', highlight(pid), children.map(c => highlight(c.PID)).join(', '));
					for (const child of children) {
						try {
							process.kill(child.PID, signal);
						} catch (e) {
							// squelch
						}
					}
				} else {
					log('Subprocess %s did not have any children', highlight(pid));
				}

				resolve(result);
			});
		});
	}

	/**
	 * Terminates all processes owned by the subprocess manager.
	 *
	 * @param {Number} [forceTimeout=2000] - The number of milliseconds to wait after asking a
	 * process to quit before forcefully killing it.
	 * @returns {Promise}
	 * @access public
	 */
	async shutdown(forceTimeout = 2000) {
		log(__n(this.subprocesses.length, 'Shutting down %d subprocess', 'Shutting down %d subprocesses'));
		await Promise.all(this.subprocesses.map(subprocess => subprocess.kill(forceTimeout)));
		this.subprocesses.splice(0, this.subprocesses.length);
	}
}
