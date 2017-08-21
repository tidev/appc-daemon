import { ServiceDispatcher } from 'appcd-dispatcher';

export default class InfoService extends ServiceDispatcher {
	constructor() {
		super('/keys*');
	}

	onCall(ctx) {
		ctx.response = 'sweet';
	}
}
