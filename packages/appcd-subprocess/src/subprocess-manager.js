import Dispatcher, { ServiceDispatcher } from 'appcd-dispatcher';

export default class SubprocessManager {
	constructor() {
		this.processes = [];

		this.dispatcher = new Dispatcher()
			.register(new ServiceDispatcher('/spawn', this))

			.register('/kill/:pid', ctx => {
				//
			})

			.register('/status', ctx => {
				ctx.response = this.processes;
			});
	}

	onCall(ctx) {
		const filter = ctx.params.filter && ctx.params.filter.replace(/^\//, '').split(/\.|\//) || undefined;
		const node = this.get(filter);
		if (!node) {
			throw new DispatcherError(codes.NOT_FOUND);
		}
		ctx.response = node;
	}

	get status() {
		return {}
	}

	shutdown() {
	}
}
