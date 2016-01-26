import autobind from 'autobind-decorator';

export default class TestService extends appcd.Service {
	init() {
		this.logger.info('hi from test service init()');

		appcd.on('appcd:start', this.start);
	}

	@autobind
	start() {
		appcd.call('/system-info')
			.then(data => {
				this.logger.info('Got the system info!');
				this.logger.info(data);
			})
			.catch(err => {
				this.logger.error(err);
			});

		this.emit('howdy');
	}

	shutdown() {
		this.logger.info('hi from test service shutdown()');
	}
}
