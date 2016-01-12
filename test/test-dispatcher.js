import Dispatcher from '../dispatcher';

describe('dispatcher', () => {

	describe('register', () => {

		it('should register with valid path and handler', () => {
			const d = new Dispatcher;
			d.register('/foo', () => {});
		});

		it('should fail with no path', () => {
			expect(() => {
				const d = new Dispatcher;
				d.register();
			}).to.throw('Invalid path');
		});

		it('should fail with bad path', () => {
			expect(() => {
				const d = new Dispatcher;
				d.register(123);
			}).to.throw('Invalid path');
		});

		it('should fail with no handler', () => {
			expect(() => {
				const d = new Dispatcher;
				d.register('/foo');
			}).to.throw('Invalid handler');
		});

		it('should fail with bad handler', () => {
			expect(() => {
				const d = new Dispatcher;
				d.register('/foo', 123);
			}).to.throw('Invalid handler');
		});

		it('should accept array of paths', () => {
			const d = new Dispatcher;
			d.register(['/foo', '/bar'], () => {});
		});

		it('should accept dispatcher handler', () => {
			const d = new Dispatcher;
			const d2 = new Dispatcher;
			d.register('/bar', () => {});
			d2.register('/foo', d);
		});
	});

	describe('dispatch', () => {

		it('should dispatch to valid route', done => {
			const d = new Dispatcher;
			let count = 0;

			d.register('/foo', () => {
				count++;
			});

			d.dispatch('/foo')
				.then(() => {
					expect(count).to.equal(1);
					done();
				})
				.catch(done);
		});

		it('should dispatch to async route', function (done) {
			this.timeout(5000);
			this.slow(5000);

			const d = new Dispatcher;
			let count = 0;

			d.register('/foo', () => {
				return new Promise((resolve, reject) => {
					setTimeout(() => {
						count++;
						resolve();
					}, 100);
				});
			});

			d.dispatch('/foo')
				.then(() => {
					expect(count).to.equal(1);
					done();
				})
				.catch(done);
		});

		it('should dispatch to valid route with payload', done => {
			const d = new Dispatcher;
			let count = 0;
			const data = { a: 1 };

			d.register('/foo', data => {
				count++;
				expect(data).to.be.an.object;
				expect(data).to.have.property('a');
				expect(data.a).to.equal(1);
			});

			d.dispatch('/foo', data)
				.then(() => {
					expect(count).to.equal(1);
					done();
				})
				.catch(done);
		});

		it('should parse params and pass them to the handler', done => {
			const d = new Dispatcher;

			d.register('/foo/:bar', data => {
				expect(data).to.be.an.object;
				expect(data).to.have.property('params');
				expect(data.params).to.have.property('bar');
				expect(data.params.bar).to.equal('abc');
			});

			d.dispatch('/foo/abc')
				.then(() => {
					done();
				})
				.catch(done);
		});

		it('should error if route not found', done => {
			const d = new Dispatcher;

			d.dispatch('/foo')
				.then(() => {
					done(new Error('Expected error for no route'));
				})
				.catch(err => {
					expect(err).to.be.instanceof(Error);
					expect(err.message).to.equal('No route');
					done();
				});
		});

		it('should handle a route that emits an error', done => {
			const d = new Dispatcher;

			d.register('/foo', data => {
				throw new Error('oops');
			});

			d.dispatch('/foo')
				.then(() => {
					done(new Error('Expected error from handler'));
				})
				.catch(err => {
					expect(err).to.be.instanceof(Error);
					expect(err.message).to.equal('oops');
					done();
				});
		});

		it('should handle a route that rejects', done => {
			const d = new Dispatcher;

			d.register('/foo', data => {
				return new Promise((resolve, reject) => {
					reject(new Error('oops'));
				});
			});

			d.dispatch('/foo')
				.then(() => {
					done(new Error('Expected error from handler'));
				})
				.catch(err => {
					expect(err).to.be.instanceof(Error);
					expect(err.message).to.equal('oops');
					done();
				});
		});

	});

});
