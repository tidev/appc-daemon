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

		// setTimeout(() => {
		// 	process.exit(1);
		// }, 5000);
	}

	shutdown() {
		this.logger.info('hi from system info shutdown()');
	}
}
