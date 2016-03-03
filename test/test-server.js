import Server from '../dist/server';

describe('server', () => {

	it('should start and stop server', done => {
		const server = new Server({
			daemon: false,
			logger: {
				silent: true
			}
		});

		server.start()
			.then(() => {
				server.shutdown()
					.then(() => done())
					.catch(done);
			})
			.catch(err => {
				server.shutdown()
					.then(() => done(err))
					.catch(done);
			});
	});

});
