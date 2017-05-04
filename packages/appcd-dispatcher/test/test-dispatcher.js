import Dispatcher from '../src/index';
import DispatcherError from '../src/dispatcher-error';
import ServiceDispatcher from '../src/service-dispatcher';

import Response, { AppcdError, codes } from 'appcd-response';

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

		it('should accept an object with a path and handler', () => {
			const d = new Dispatcher;
			d.register({
				path: '/foo',
				handler: () => {}
			});
		});

		it('should accept a ServiceDispatcher without any paths', () => {
			const d = new Dispatcher;
			d.register(new ServiceDispatcher('/foo', {}));
		});

		it('should accept a path and a ServiceDispatcher with a path', () => {
			const d = new Dispatcher;
			d.register('/foo', new ServiceDispatcher('/bar', {}));
		});

		it('should accept a path and ServiceDispatcher without a path', () => {
			const d = new Dispatcher;
			d.register('/foo', new ServiceDispatcher({}));
		});
	});

	describe('dispatch', () => {
		it('should dispatch to valid route', done => {
			const d = new Dispatcher;
			let count = 0;

			d.register('/foo', () => {
				count++;
			});

			d.call('/foo')
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

			d.call('/foo')
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

			d.register('/foo', ctx => {
				count++;
				expect(ctx.payload).to.be.an.object;
				expect(ctx.payload).to.have.property('a');
				expect(ctx.payload.a).to.equal(1);
			});

			d.call('/foo', data)
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

			d.call('/foo/abc')
				.then(() => {
					done();
				})
				.catch(done);
		});

		it('should error if route not found', done => {
			const d = new Dispatcher;

			d.call('/foo')
				.then(() => {
					done(new Error('Expected error for no route'));
				})
				.catch(err => {
					expect(err).to.be.instanceof(Error);
					expect(err.message).to.equal('Not Found');
					done();
				})
				.catch(done);
		});

		it('should handle a route that emits an error', done => {
			const d = new Dispatcher;

			d.register('/foo', data => {
				throw new Error('oops');
			});

			d.call('/foo')
				.then(() => {
					done(new Error('Expected error from handler'));
				})
				.catch(err => {
					expect(err).to.be.instanceof(Error);
					expect(err.message).to.equal('oops');
					done();
				})
				.catch(done);
		});

		it('should handle a route that emits an DispatcherError', done => {
			const d = new Dispatcher;

			d.register('/foo', data => {
				throw new DispatcherError(123, 'oops');
			});

			d.call('/foo')
				.then(() => {
					done(new Error('Expected error from handler'));
				})
				.catch(err => {
					expect(err).to.be.instanceof(DispatcherError);
					expect(err.status).to.equal(123);
					expect(err.message).to.equal('oops');
					done();
				})
				.catch(done);
		});

		it('should handle a route that emits an DispatcherError with no status', done => {
			const d = new Dispatcher;

			d.register('/foo', data => {
				throw new DispatcherError('oops');
			});

			d.call('/foo')
				.then(() => {
					done(new Error('Expected error from handler'));
				})
				.catch(err => {
					expect(err).to.be.instanceof(DispatcherError);
					expect(err.status).to.be.undefined;
					expect(err.message).to.equal('oops');
					done();
				})
				.catch(done);
		});

		it('should handle a route that emits an DispatcherError with no args', done => {
			const d = new Dispatcher;

			d.register('/foo', data => {
				throw new DispatcherError(123);
			});

			d.call('/foo')
				.then(() => {
					done(new Error('Expected error from handler'));
				})
				.catch(err => {
					expect(err).to.be.instanceof(DispatcherError);
					expect(err.status).to.equal(123);
					expect(err.message).to.equal('Unknown Error');
					done();
				})
				.catch(done);
		});

		it('should handle a route that rejects', done => {
			const d = new Dispatcher;

			d.register('/foo', data => {
				return new Promise((resolve, reject) => {
					reject(new Error('oops'));
				});
			});

			d.call('/foo')
				.then(() => {
					done(new Error('Expected error from handler'));
				})
				.catch(err => {
					expect(err).to.be.instanceof(Error);
					expect(err.message).to.equal('oops');
					done();
				})
				.catch(done);
		});

		it('should handle a route that returns error', done => {
			const d = new Dispatcher;

			d.register('/foo', (data, next) => {
				throw new Error('oops');
			});

			d.call('/foo')
				.then(() => {
					done(new Error('Expected error from handler'));
				})
				.catch(err => {
					expect(err).to.be.instanceof(Error);
					expect(err.message).to.equal('oops');
					done();
				})
				.catch(done);
		});

		it('should re-route to error', done => {
			const d = new Dispatcher;
			let fooCount = 0;

			d.register('/foo', async (data, next) => {
				fooCount++;
				await next();
			});

			d.call('/foo')
				.then(ctx => {
					done(new Error('Expected error for no route'));
				})
				.catch(err => {
					expect(fooCount).to.equal(1);
					expect(err).to.be.instanceof(AppcdError);
					expect(err.message).to.equal('Not Found');
					done();
				})
				.catch(done);
		});

		it('should re-route to new route', done => {
			const d = new Dispatcher;
			let fooCount = 0;
			let barCount = 0;

			d.register('/foo', async (data, next) => {
				fooCount++;
				data.path = '/bar';
				await next();
			});

			d.register('/bar', data => {
				barCount++;
			});

			d.call('/foo')
				.then(() => {
					expect(fooCount).to.equal(1);
					expect(barCount).to.equal(1);
					done();
				})
				.catch(done);
		});

		it('should scan multiple routes', done => {
			const d = new Dispatcher;
			let count = 0;

			d.register('/foo', async (data, next) => {
				await next();
			});

			d.register('/bar', async (data, next) => {
				count++;
			});

			d.call('/bar')
				.then(() => {
					expect(count).to.equal(1);
					done();
				})
				.catch(done);
		});

		it('should be ok if next() is called multiple times', done => {
			const d = new Dispatcher;
			let count = 0;

			d.register('/foo', async (data, next) => {
				count++;
				await next();
				await next(); // technically an error, but it won't do any harm
			});

			d.register('/foo', async (data, next) => {
				count++;
			});

			d.call('/foo')
				.then(() => {
					expect(count).to.equal(2);
					done();
				})
				.catch(done);
		});

		it('should handle route to child dispatcher handler', done => {
			const d = new Dispatcher;
			const d2 = new Dispatcher;
			let count = 0;

			d.register('/bar', () => {
				count++;
			});
			d2.register('/foo', d);

			d2.call('/foo/bar')
				.then(() => {
					expect(count).to.equal(1);
					done();
				})
				.catch(done);
		});

		it('should handle route to child dispatcher handler (reordered)', done => {
			const d = new Dispatcher;
			const d2 = new Dispatcher;
			let count = 0;

			d2.register('/foo', d);
			d.register('/bar', () => {
				count++;
			});

			d2.call('/foo/bar')
				.then(() => {
					expect(count).to.equal(1);
					done();
				})
				.catch(done);
		});

		it('should route to deeply nested dispatchers', done => {
			const d = new Dispatcher;
			const d2 = new Dispatcher;
			const d3 = new Dispatcher;
			let count = 0;

			d.register('/foo', d2);
			d2.register('/bar', d3);
			d3.register('/baz', () => {
				count++;
			});

			d.call('/foo/bar/baz')
				.then(() => {
					expect(count).to.equal(1);
					done();
				})
				.catch(done);
		});

		it('should error if no route to child dispatcher handler', done => {
			const d = new Dispatcher;
			const d2 = new Dispatcher;

			d2.register('/foo', d);

			d2.call('/foo/baz')
				.then(() => {
					done(new Error('Expected error for no route'));
				})
				.catch(err => {
					expect(err).to.be.instanceof(AppcdError);
					expect(err.message).to.equal('Not Found');
					done();
				})
				.catch(done);
		});

		it('should error if path is invalid', () => {
			const d = new Dispatcher;

			expect(() => {
				d.call();
			}).to.throw(TypeError, 'Expected path to be a string');

			expect(() => {
				d.call(123);
			}).to.throw(TypeError, 'Expected path to be a string');

			expect(() => {
				d.call(null);
			}).to.throw(TypeError, 'Expected path to be a string');
		});

		it('should return 404 status if not found', done => {
			const d = new Dispatcher;

			d.register('/foo', ctx => {
				ctx.response = new Response(codes.NOT_FOUND);
			});

			d.call('/foo')
				.then(result => {
					expect(result.status).equal(404);
					done();
				})
				.catch(done);
		});
	});

	describe('middleware', () => {
		it('should return a middleware callback function', () => {
			const d = new Dispatcher;
			const middleware = d.callback();
			expect(middleware).to.be.a.Function;
		});

		it('should dispatch GET request', done => {
			const d = new Dispatcher;

			d.register('/foo', ctx => {
				ctx.response = 'foo!';
			});

			const middleware = d.callback();
			const ctx = {
				method: 'GET',
				originalUrl: '/foo'
			};

			Promise.resolve()
				.then(() => middleware(ctx, Promise.resolve))
				.then(() => {
					expect(ctx.body).to.be.a.String;
					expect(ctx.body).to.equal('foo!');
					done();
				})
				.catch(done);
		});

		it('should call next middleware if no route', done => {
			const d = new Dispatcher;
			const middleware = d.callback();
			const ctx = {
				method: 'GET',
				originalUrl: '/bar'
			};
			let count = 0;
			const next = () => {
				count++;
			};

			Promise.resolve()
				.then(() => middleware(ctx, next))
				.then(() => {
					expect(count).to.equal(1);
					done();
				})
				.catch(done);
		});

		it('should deeply call next middleware if no route', done => {
			const d = new Dispatcher;
			const middleware = d.callback();
			const ctx = {
				method: 'GET',
				originalUrl: '/bar'
			};
			let count = 0;
			const next = () => {
				count++;
			};

			Promise.resolve()
				.then(() => middleware(ctx, next))
				.then(() => {
					expect(count).to.equal(1);
					done();
				})
				.catch(done);
		});

		it('should dispatch POST request', done => {
			const d = new Dispatcher;

			d.register('/foo', ctx => {
				expect(ctx.payload).to.deep.equal({ data: { foo: 'bar' }, headers: {}, source: 'http' });
				ctx.response = 'foo!';
			});

			const middleware = d.callback();
			const ctx = {
				method: 'POST',
				originalUrl: '/foo',
				request: {
					body: {
						foo: 'bar'
					},
					acceptsLanguages: () => {}
				}
			};

			Promise.resolve()
				.then(() => middleware(ctx, Promise.resolve))
				.then(() => {
					expect(ctx.body).to.be.a.String;
					expect(ctx.body).to.equal('foo!');
					done();
				})
				.catch(done);
		});

		it('should ignore HEAD request', done => {
			const d = new Dispatcher;
			let count = 0;
			let count2 = 0;

			d.register('/', ctx => {
				count2++;
			});

			const middleware = d.callback();
			const ctx = {
				method: 'HEAD',
				originalUrl: '/'
			};
			const next = () => {
				count++;
			};

			Promise.resolve()
				.then(() => middleware(ctx, next))
				.then(() => {
					expect(count).to.equal(1);
					expect(count2).to.equal(0);
					done();
				})
				.catch(done);
		});

		it('should return 500 error if handler throws error', done => {
			const d = new Dispatcher;

			d.register('/foo', ctx => {
				throw new Error('foo!');
			});

			const middleware = d.callback();
			const ctx = {
				method: 'GET',
				originalUrl: '/foo'
			};

			Promise.resolve()
				.then(() => middleware(ctx, Promise.resolve))
				.then(() => {
					expect(ctx.status).to.equal(500);
					expect(ctx.body).to.equal('Error: foo!');
					done();
				})
				.catch(done);
		});

		it('should return dispatcher error', done => {
			const d = new Dispatcher;

			d.register('/foo', ctx => {
				throw new DispatcherError(403, 'Not authorized!');
			});

			const middleware = d.callback();
			const ctx = {
				method: 'GET',
				originalUrl: '/foo'
			};

			Promise.resolve()
				.then(() => middleware(ctx, Promise.resolve))
				.then(() => {
					expect(ctx.status).to.equal(403);
					expect(ctx.body).to.equal('DispatcherError: Not authorized! (code 403)');
					done();
				})
				.catch(done);
		});

		it('should return dispatcher error with null status', done => {
			const d = new Dispatcher;

			d.register('/foo', ctx => {
				const err = new DispatcherError(403, 'Not authorized!');
				err.status = null;
				throw err;
			});

			const middleware = d.callback();
			const ctx = {
				method: 'GET',
				originalUrl: '/foo',
				request: {
					acceptsLanguages: () => ''
				}
			};

			Promise.resolve()
				.then(() => middleware(ctx, Promise.resolve))
				.then(() => {
					expect(ctx.status).to.equal(500);
					expect(ctx.body).to.equal('DispatcherError: Not authorized! (code 403)');
					done();
				})
				.catch(done);
		});

		it('should return a Response object', done => {
			const d = new Dispatcher;

			d.register('/foo', ctx => {
				ctx.response = new Response(codes.OK);
			});

			const middleware = d.callback();
			const ctx = {
				method: 'GET',
				originalUrl: '/foo',
				req: {
					headers: {}
				},
				request: {
					acceptsLanguages: () => ''
				}
			};

			Promise.resolve()
				.then(() => middleware(ctx, Promise.resolve))
				.then(() => {
					expect(ctx.status).to.equal(200);
					expect(ctx.body).to.be.a.String;
					expect(ctx.body).to.equal('OK');
					done();
				})
				.catch(done);
		});

		it('should return a Response object with null status', done => {
			const d = new Dispatcher;

			d.register('/foo', ctx => {
				ctx.response = new Response(codes.OK);
				ctx.response.status = null;
			});

			const middleware = d.callback();
			const ctx = {
				method: 'GET',
				originalUrl: '/foo'
			};

			Promise.resolve()
				.then(() => middleware(ctx, Promise.resolve))
				.then(() => {
					expect(ctx.status).to.equal(200);
					expect(ctx.body).to.be.a.String;
					expect(ctx.body).to.equal('OK');
					done();
				})
				.catch(done);
		});
	});

	describe('Root Dispatcher', () => {
		beforeEach(() => {
			Dispatcher.root.routes = [];
		});

		afterEach(() => {
			Dispatcher.root.routes = [];
		});

		it('should register handler and call it', done => {
			let count = 0;

			Dispatcher.register('/foo', () => {
				count++;
			});

			Dispatcher.call('/foo')
				.then(() => {
					expect(count).to.equal(1);
					done();
				})
				.catch(done);
		});

		it('should dispatch GET request', done => {
			Dispatcher.register('/foo', ctx => {
				ctx.response = 'foo!';
			});

			const middleware = Dispatcher.callback();
			const ctx = {
				method: 'GET',
				originalUrl: '/foo'
			};

			Promise.resolve()
				.then(() => middleware(ctx, Promise.resolve))
				.then(() => {
					expect(ctx.body).to.be.a.String;
					expect(ctx.body).to.equal('foo!');
					done();
				})
				.catch(done);
		});
	});
});
