import Dispatcher, { DispatcherError, ServiceDispatcher } from 'appcd-dispatcher';
import gawk, { GawkArray } from 'gawk';
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

			.register('/spawn', ctx => new Promise((resolve, reject) => {
				const { data, source } = ctx.payload;

				if (source === 'http') { // || source === 'websocket') {
					throw new SubprocessError(codes.FORBIDDEN, 'Spawn not permitted');
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

				if (child.stdout) {
					child.stdout.on('data', data => ctx.response.write({ type: 'stdout', output: data.toString() }));
				}

				if (child.stderr) {
					child.stdout.on('data', data => ctx.response.write({ type: 'stderr', output: data.toString() }));
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
