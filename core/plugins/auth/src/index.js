export default class AuthService extends appcd.Service {
	init() {
		this.logger.info('hi from auth init()');
	}

	shutdown() {
		this.logger.info('hi from auth shutdown()');
	}
}
