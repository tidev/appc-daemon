export default class InfoService extends appcd.Service {
	init() {
		this.logger.info('hi from system info init()');

		this.register('/', () => {
			// ctx.data
			return {
				foo: 'bar'
			};
		});

		appcd.on('howdy', () => {
			console.log('got howdy');
		});

		appcd.on('test:howdy', () => {
			console.log('got test:howdy');
		});
	}

	shutdown() {
		this.logger.info('hi from system info shutdown()');
	}
}
