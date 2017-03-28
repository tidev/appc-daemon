import Dispatcher, { DispatcherError, ServiceDispatcher } from 'appcd-dispatcher';
import gawk, { GawkArray } from 'gawk';
import NanoBuffer from 'nanobuffer';
import snooplogg from 'snooplogg';
import SubprocessError from './subprocess-error';

import { EventEmitter } from 'events';
import { spawn } from './subprocess';

const { codes } = DispatcherError;

const logger = snooplogg.config({ theme: 'detailed' })('appcd:subprocess:manager');
const { highlight, note } = snooplogg.styles;

export default class SubprocessManager extends EventEmitter {
	constructor() {
		super();

		const subprocesses = this.subprocesses = new GawkArray;

		this.dispatcher = new Dispatcher()
			.register(new ServiceDispatcher('/spawn/node/:version?', {
				onCall(ctx) {
					ctx.response = 'spawning node';
				}
			}))

			.register(new ServiceDispatcher('/spawn', {
				onCall(ctx) {
					return new Promise((resolve, reject) => {
						const { data } = ctx.payload;

						if (data.hasOwnProperty('options') && data.options && data.options.hasOwnProperty('maxBuffer') && (typeof data.options.maxBuffer !== 'number' || data.options.maxBuffer < 0)) {
							throw new SubprocessError(codes.INVALID_ARGUMENT, 'Spawn max buffer must be a positive integer');
						}

						const { command, args, child } = spawn(data);

						child.on('error', e => reject(new SubprocessError(e)));

						const { pid } = child;
						logger.log('%s spawned', highlight(pid));

						subprocesses.push({
							pid,
							command,
							args,
							startTime: new Date
						});

						const output = (child.stdout || child.stderr) && data.maxBuffer > 0 ? new NanoBuffer(data.maxBuffer) : [];

						if (child.stdout) {
							child.stdout.on('data', data => output.push([1, data.toString()]));
						}

						if (child.stderr) {
							child.stderr.on('data', data => output.push([2, data.toString()]));
						}

						child.on('close', code => {
							logger.log('%s exited (code %s)', highlight(pid), code);

							for (const i = 0, l = subprocesses.length; i < l; i++) {
								if (subprocesses[i].pid === pid) {
									subprocesses.splice(i, 1);
									break;
								}
							}

							ctx.response = {
								code,
								output: Array.from(output)
							};

							resolve();
						});
					});
				}
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
