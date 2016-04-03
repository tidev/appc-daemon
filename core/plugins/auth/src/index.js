export default class AuthService extends appcd.Service {
	init() {
		this.logger.info('hi from auth init()');

		appcd.on('appcd:start', () => {
			this.emit('analytics:event', { type: 'auth' });
		});
	}

	shutdown() {
		this.logger.info('hi from auth shutdown()');
	}
}
