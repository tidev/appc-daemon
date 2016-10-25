import Server from '../dist/server';

describe('server', () => {

	describe('config', () => {
		it('should init from constructor args', () => {
			const server = new Server({
				analytics: {
					enabled: false
				},
				appcd: {
					foo: 'bar'
				},
				logger: {
					silent: true
				}
			});

			const cfg = server.config();
			expect(cfg).to.be.an.object;
			expect(cfg.logger).to.be.an.object;
			expect(cfg.logger.silent).to.equal(true);

			expect(server.config('logger')).to.be.an.object;
			expect(server.config('logger.silent')).to.equal(true);
			expect(server.config('appcd')).to.be.an.object;
			expect(server.config('appcd.foo')).to.equal('bar');
			expect(server.config('nothing')).to.be.undefined;
		});

		it('should fallback to default values', () => {
			const server = new Server({
				logger: {
					silent: true
				}
			});

			expect(server.config('appcd.foo', 'bar')).to.equal('bar');
			expect(server.config('foo', 'baz')).to.equal('baz');
		});
	});

	describe('start', () => {
		it('should start and stop server', function (done) {
			this.slow(4000);
			this.timeout(5000);

			const server = new Server({
				analytics: {
					enabled: false
				},
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

});
