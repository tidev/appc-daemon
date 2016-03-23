export default class AuthService extends appcd.Service {
	init() {
		this.logger.info('hi from auth init()');

		appcd.on('appcd:server.start', () => {
			setTimeout(() => {
				this.emit('analytics:event', { type: 'auth' });
			}, 1000);
		});
	}

	shutdown() {
		this.logger.info('hi from auth shutdown()');
	}
}
