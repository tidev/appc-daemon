import Dispatcher from 'appcd-dispatcher';
import gawk, { GawkArray } from 'gawk';
import Response, { i18n } from 'appcd-response';
import snooplogg from 'snooplogg';
import SubprocessError from './subprocess-error';

import { EventEmitter } from 'events';
import { expandPath } from 'appcd-path';
import { prepareNode } from 'appcd-nodejs';
import { spawn } from './subprocess';

const { __, __n } = i18n();
const { codes } = SubprocessError;

const logger = snooplogg.config({ theme: 'detailed' })('appcd:subprocess:manager');
const { highlight, note } = snooplogg.styles;

/**
 * Manages spawned subprocesses through dispatcher handlers.
 */
export default class SubprocessManager extends EventEmitter {
	/**
	 * Creates the `SubprocessManager` and wires up the dispatcher handlers.
	 *
	 * @access public
	 */
	constructor() {
		super();

		const subprocesses = this.subprocesses = new GawkArray;

		const dispatcher = this.dispatcher = new Dispatcher()
			.register('/spawn/node/:version?', ctx => {
				const { data, source } = ctx.payload;

				// if the source is http, then block the spawn
				if (source === 'http') {
					throw new SubprocessError(codes.FORBIDDEN, 'Spawn not permitted');
				}

				return Promise.resolve()
					.then(() => Dispatcher.call('/appcd/config/home'))
					.then(({ response }) => expandPath(response, 'node'))
					.then(nodeHome => prepareNode({ nodeHome, version: ctx.params.version || process.version }))
					.then(node => dispatcher.call('/spawn', { data: { ...data, command: node } }));
			})

			.register('/spawn', ctx => new Promise((resolve, reject) => {
				const { data, source } = ctx.payload;
				console.log(ctx);

				// if the source is http, then block the spawn
				if (source === 'http') {
					throw new SubprocessError(codes.FORBIDDEN, 'Spawn not permitted');
				}

				let tries = 3;
				const trySpawn = () => {
					return Promise.resolve()
						.then(() => {
							tries--;
							return spawn(data);
						})
						.catch(err => {
							console.log('ERROR!', err);
							if (err.code === 'ETXTBSY' && tries) {
								logger.log('Spawn threw ETXTBSY, retrying...');
								return new Promise((resolve, reject) => {
									setTimeout(() => trySpawn().then(resolve, reject), 50);
								});
							}
							throw err;
						});
				};

				trySpawn()
					.then(result => {
						const { command, args, child } = result;

						child.on('error', e => reject(new SubprocessError(e)));

						const { pid } = child;
						logger.log('Spawned %s', highlight(pid));

						subprocesses.push({
							pid,
							command,
							args,
							startTime: new Date
						});

						if (child.stdout) {
							child.stdout.on('data', data => ctx.response.write({ type: 'stdout', output: data.toString() }));
						}

						if (child.stderr) {
							child.stderr.on('data', data => ctx.response.write({ type: 'stderr', output: data.toString() }));
						}

						child.on('close', code => {
							logger.log('%s exited (code %s)', highlight(pid), code);

							for (const i = 0, l = subprocesses.length; i < l; i++) {
								if (subprocesses[i].pid === pid) {
									subprocesses.splice(i, 1);
									break;
								}
							}

							ctx.response.end({
								type: 'exit',
								code
							});

							resolve();
						});
					})
					.catch(err => reject(new SubprocessError(err)));
			}))

			.register('/kill/:pid?', ctx => {
				if (!ctx.params.pid) {
					throw new SubprocessError(codes.MISSING_PARAMETER, 'Missing required "%s" parameter', 'pid');
				}

				const pid = parseInt(ctx.params.pid);
				if (isNaN(pid) || pid < 0) {
					throw new SubprocessError(codes.INVALID_PARAMETER, 'The "%s" parameter must be a positive integer', 'pid');
				}

				let signal = ctx.payload.data && ctx.payload.data.signal || 'SIGTERM';
				if (signal === '0') {
					signal = 0;
				}

				logger.log('Kill %s %s', highlight(pid), signal);

				try {
					process.kill(pid, signal);
					ctx.response = new Response(codes.OK);
				} catch (e) {
					if (e.code === 'ESRCH') {
						ctx.response = new Response(codes.PROCESS_NOT_FOUND);
					} else {
						throw new SubprocessError(e);
					}
				}
			})

			.register('/status', ctx => {
				ctx.response = this.subprocesses;
			});

		gawk.watch(this.subprocesses, (obj, src) => this.emit('change', obj, src));
	}

	/**
	 * Terminates all processes owned by the subprocess manager.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	shutdown() {
		logger.log(__n(this.subprocesses.length, 'Shutting down %d subprocess', 'Shutting down %d subprocesses'));

		for (const subprocess of this.subprocesses) {
			logger.log('Killing subprocess %s', highlight(subprocess.pid));
			try {
				process.kill(subprocess.pid);
			} catch (e) {
				// squeltch
			}
		}
	}
}
