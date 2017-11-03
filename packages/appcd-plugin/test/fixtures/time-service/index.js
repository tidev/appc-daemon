const ServiceDispatcher = require('appcd-dispatcher').ServiceDispatcher;

class CurrentTimeService extends ServiceDispatcher {
	constructor() {
		super('/current-time');
	}

	onCall(ctx) {
		ctx.response = new Date().toISOString();
	}

	onSubscribe({ publish }) {
		console.log('Starting interval');
		this.timer = setInterval(() => {
			publish({
				time: new Date().toISOString()
			});
		}, 1000);
	}

	onUnsubscribe() {
		console.log('Stopping interval');
		clearInterval(this.timer);
	}
}

module.exports = {
	activate() {
		appcd.register(new CurrentTimeService());
	}
};
