export default class TestService extends appcd.Service {
	init() {
		this.logger.info('hi from test service init()');
	}

	shutdown() {
		this.logger.info('hi from test service shutdown()');
	}
}
