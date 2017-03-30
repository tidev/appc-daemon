import Dispatcher, { DispatcherError } from 'appcd-dispatcher';
import gawk, { GawkArray } from 'gawk';
import snooplogg from 'snooplogg';
import SubprocessError from './subprocess-error';

import { EventEmitter } from 'events';
import { expandPath } from 'appcd-path';
import { prepareNode } from 'appcd-nodejs';
import { spawn } from './subprocess';

const { codes } = DispatcherError;

const logger = snooplogg.config({ theme: 'detailed' })('appcd:subprocess:manager');
const { highlight, note } = snooplogg.styles;

export default class SubprocessManager extends EventEmitter {
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
						logger.log('%s spawned', highlight(pid));

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

			.register('/kill/:pid', ctx => {
				//
			})

			.register('/status', ctx => {
				ctx.response = this.subprocesses;
			});

		gawk.watch(this.subprocesses, (obj, src) => this.emit('change', obj, src));
	}

	get status() {
		return {};
	}

	shutdown() {
	}
}
