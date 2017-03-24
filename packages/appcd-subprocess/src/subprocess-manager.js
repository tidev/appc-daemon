import Dispatcher, { DispatcherError, ServiceDispatcher } from 'appcd-dispatcher';
import gawk, { GawkArray } from 'gawk';
import snooplogg from 'snooplogg';

import { EventEmitter } from 'events';

const logger = snooplogg.config({ theme: 'detailed' })('appcd:plugin:manager');
const { highlight, note } = snooplogg.styles;

export default class SubprocessManager extends EventEmitter {
	constructor() {
		super();

		this.subprocesses = new GawkArray;

		this.dispatcher = new Dispatcher()
			.register(new ServiceDispatcher('/spawn', {
				onCall(ctx) {
					const filter = ctx.params.filter && ctx.params.filter.replace(/^\//, '').split(/\.|\//) || undefined;
					const node = this.get(filter);
					if (!node) {
						throw new DispatcherError(codes.NOT_FOUND);
					}
					ctx.response = node;
				}
			}))

			.register(new ServiceDispatcher('/spawn-node', {
				//
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
