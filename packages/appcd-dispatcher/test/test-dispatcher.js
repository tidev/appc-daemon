import Dispatcher from '../dist/index';
import DispatcherError from '../dist/dispatcher-error';
import Response, { AppcdError, codes } from 'appcd-response';
import ServiceDispatcher from '../dist/service-dispatcher';

import { WritableStream } from 'memory-streams';

class TestServiceDispatcher extends ServiceDispatcher {}

describe('dispatcher', () => {
	describe('register', () => {
		it('should register with valid path and handler', () => {
			const d = new Dispatcher();
			d.register('/foo', () => {});
		});

		it('should fail with no path', () => {
			expect(() => {
				const d = new Dispatcher();
				d.register();
			}).to.throw('Invalid path');
		});

		it('should fail with bad path', () => {
			expect(() => {
				const d = new Dispatcher();
				d.register(123);
			}).to.throw('Invalid path');
		});

		it('should fail with no handler', () => {
			expect(() => {
				const d = new Dispatcher();
				d.register('/foo');
			}).to.throw('Invalid handler');
		});

		it('should fail with bad handler', () => {
			expect(() => {
				const d = new Dispatcher();
				d.register('/foo', 123);
			}).to.throw('Invalid handler');
		});

		it('should accept array of paths', () => {
			const d = new Dispatcher();
			d.register([ '/foo', '/bar' ], () => {});
		});

		it('should accept dispatcher handler', () => {
			const d = new Dispatcher();
			const d2 = new Dispatcher();
			d.register('/bar', () => {});
			d2.register('/foo', d);
		});

		it('should accept an object with a path and handler', () => {
			const d = new Dispatcher();
			d.register({
				path: '/foo',
				handler: () => {}
			});
		});

		it('should accept a ServiceDispatcher without any paths', () => {
			const d = new Dispatcher();
			d.register(new TestServiceDispatcher('/foo', {}));
		});

		it('should accept a path and a ServiceDispatcher with a path', () => {
			const d = new Dispatcher();
			d.register('/foo', new TestServiceDispatcher('/bar', {}));
		});

		it('should accept a path and ServiceDispatcher without a path', () => {
			const d = new Dispatcher();
			d.register('/foo', new TestServiceDispatcher({}));
		});
	});

	describe('dispatch', () => {
		it('should dispatch to valid route', async () => {
			const d = new Dispatcher();
			let count = 0;

			d.register('/foo', () => {
				count++;
			});

			await d.call('/foo');
			expect(count).to.equal(1);
		});

		it('should dispatch to async route', async () => {
			const d = new Dispatcher();
			let count = 0;

			d.register('/foo', () => {
				return new Promise(resolve => {
					setTimeout(() => {
						count++;
						resolve();
					}, 100);
				});
			});

			await d.call('/foo');
			expect(count).to.equal(1);
		});

		it('should dispatch to valid route with payload', async () => {
			const d = new Dispatcher();
			let count = 0;
			const data = { a: 1 };

			d.register('/foo', ctx => {
				count++;
				expect(ctx.request).to.be.an('object');
				expect(ctx.request).to.have.property('a');
				expect(ctx.request.a).to.equal(1);
			});

			await d.call('/foo', data);
			expect(count).to.equal(1);
		});

		it('should parse params and pass them to the handler', async () => {
			const d = new Dispatcher();

			d.register('/foo/:bar', ctx => {
				expect(ctx).to.be.an('object');
				expect(ctx).to.have.property('request');
				expect(ctx.request).to.have.property('params');
				expect(ctx.request.params).to.have.property('bar');
				expect(ctx.request.params.bar).to.equal('abc');
			});

			await d.call('/foo/abc');
		});

		it('should error if route not found', async () => {
			const d = new Dispatcher();

			try {
				await d.call('/foo');
			} catch (err) {
				expect(err).to.be.instanceof(Error);
				expect(err.message).to.equal('Not Found');
				return;
			}

			throw new Error('Expected error for no route');
		});

		it('should handle a route that emits an error', async () => {
			const d = new Dispatcher();

			d.register('/foo', () => {
				throw new Error('oops');
			});

			try {
				await d.call('/foo');
			} catch (err) {
				expect(err).to.be.instanceof(Error);
				expect(err.message).to.equal('oops');
				return;
			}

			throw new Error('Expected error from handler');
		});

		it('should handle a route that emits an DispatcherError', async () => {
			const d = new Dispatcher();

			d.register('/foo', () => {
				throw new DispatcherError(123, 'oops');
			});

			try {
				await d.call('/foo');
			} catch (err) {
				expect(err).to.be.instanceof(DispatcherError);
				expect(err.status).to.equal(123);
				expect(err.message).to.equal('oops');
				return;
			}

			throw new Error('Expected error from handler');
		});

		it('should handle a route that emits an DispatcherError with no status', async () => {
			const d = new Dispatcher();

			d.register('/foo', () => {
				throw new DispatcherError('oops');
			});

			try {
				await d.call('/foo');
			} catch (err) {
				expect(err).to.be.instanceof(DispatcherError);
				expect(err.status).to.be.undefined;
				expect(err.message).to.equal('oops');
				return;
			}

			throw new Error('Expected error from handler');
		});

		it('should handle a route that emits an DispatcherError with no args', async () => {
			const d = new Dispatcher();

			d.register('/foo', () => {
				throw new DispatcherError(123);
			});

			try {
				await d.call('/foo');
			} catch (err) {
				expect(err).to.be.instanceof(DispatcherError);
				expect(err.status).to.equal(123);
				expect(err.message).to.equal('Unknown Error');
				return;
			}

			throw new Error('Expected error from handler');
		});

		it('should handle a route that rejects', async () => {
			const d = new Dispatcher();

			d.register('/foo', () => {
				return new Promise((resolve, reject) => {
					reject(new Error('oops'));
				});
			});

			try {
				await d.call('/foo');
			} catch (err) {
				expect(err).to.be.instanceof(Error);
				expect(err.message).to.equal('oops');
				return;
			}

			throw new Error('Expected error from handler');
		});

		it('should handle a route that returns error', async ()  => {
			const d = new Dispatcher();

			d.register('/foo', () => {
				throw new Error('oops');
			});

			try {
				await d.call('/foo');
			} catch (err) {
				expect(err).to.be.instanceof(Error);
				expect(err.message).to.equal('oops');
				return;
			}

			throw new Error('Expected error from handler');
		});

		it('should re-route to error', async () => {
			const d = new Dispatcher();
			let fooCount = 0;

			d.register('/foo', async (data, next) => {
				fooCount++;
				await next();
			});

			try {
				await d.call('/foo');
			} catch (err) {
				expect(fooCount).to.equal(1);
				expect(err).to.be.instanceof(AppcdError);
				expect(err.message).to.equal('Not Found');
				return;
			}

			throw new Error('Expected error for no route');
		});

		it('should re-route to new route', async () => {
			const d = new Dispatcher();
			let fooCount = 0;
			let barCount = 0;

			d.register('/foo', async (data, next) => {
				fooCount++;
				data.path = '/bar';
				await next();
			});

			d.register('/bar', () => {
				barCount++;
			});

			await d.call('/foo');
			expect(fooCount).to.equal(1);
			expect(barCount).to.equal(1);
		});

		it('should scan multiple routes', async () => {
			const d = new Dispatcher();
			let count = 0;

			d.register('/foo', async (data, next) => {
				await next();
			});

			d.register('/bar', async () => {
				count++;
			});

			await d.call('/bar');
			expect(count).to.equal(1);
		});

		it('should be ok if next() is called multiple times', async () => {
			const d = new Dispatcher();
			let count = 0;

			d.register('/foo', async (data, next) => {
				count++;
				await next();
				await next(); // technically an error, but it won't do any harm
			});

			d.register('/foo', async () => {
				count++;
			});

			await d.call('/foo');
			expect(count).to.equal(2);
		});

		it('should handle route to child dispatcher handler', async () => {
			const d = new Dispatcher();
			const d2 = new Dispatcher();
			let count = 0;

			d.register('/bar', () => {
				count++;
			});
			d2.register('/foo', d);

			await d2.call('/foo/bar');
			expect(count).to.equal(1);
		});

		it('should handle route to child dispatcher handler (reordered)', async () => {
			const d = new Dispatcher();
			const d2 = new Dispatcher();
			let count = 0;

			d2.register('/foo', d);
			d.register('/bar', () => {
				count++;
			});

			await d2.call('/foo/bar');
			expect(count).to.equal(1);
		});

		it('should route to deeply nested dispatchers', async () => {
			const d = new Dispatcher();
			const d2 = new Dispatcher();
			const d3 = new Dispatcher();
			let count = 0;

			d.register('/foo', d2);
			d2.register('/bar', d3);
			d3.register('/baz', () => {
				count++;
			});

			await d.call('/foo/bar/baz');
			expect(count).to.equal(1);
		});

		it('should error if no route to child dispatcher handler', async () => {
			const d = new Dispatcher();
			const d2 = new Dispatcher();

			d2.register('/foo', d);

			try {
				await d2.call('/foo/baz');
			} catch (err) {
				expect(err).to.be.instanceof(AppcdError);
				expect(err.message).to.equal('Not Found');
				return;
			}

			throw new Error('Expected error for no route');
		});

		it('should error if path is invalid', async () => {
			const d = new Dispatcher();

			try {
				await d.call();
			} catch (e) {
				expect(e).to.be.instanceof(TypeError);
				expect(e.message).to.equal('Expected path to be a string');
			}

			try {
				await d.call(123);
			} catch (e) {
				expect(e).to.be.instanceof(TypeError);
				expect(e.message).to.equal('Expected path to be a string');
			}

			try {
				await d.call(null);
			} catch (e) {
				expect(e).to.be.instanceof(TypeError);
				expect(e.message).to.equal('Expected path to be a string');
			}
		});

		it('should return 404 status if not found', async () => {
			const d = new Dispatcher();

			d.register('/foo', ctx => {
				ctx.response = new Response(codes.NOT_FOUND);
			});

			const result = await d.call('/foo');
			expect(result.status).equal(404);
		});
	});

	describe('middleware', () => {
		it('should return a middleware callback function', () => {
			const d = new Dispatcher();
			const middleware = d.callback();
			expect(middleware).to.be.a('function');
		});

		it('should dispatch GET request', async () => {
			const d = new Dispatcher();

			d.register('/foo', ctx => {
				ctx.response = 'foo!';
			});

			const middleware = d.callback();
			const ctx = {
				method: 'GET',
				originalUrl: '/foo'
			};

			await middleware(ctx, Promise.resolve);
			expect(ctx.body).to.be.a('string');
			expect(ctx.body).to.equal('foo!');
		});

		it('should call next middleware if no route', async () => {
			const d = new Dispatcher();
			const middleware = d.callback();
			const ctx = {
				method: 'GET',
				originalUrl: '/bar'
			};
			let count = 0;
			const next = () => {
				count++;
			};

			await middleware(ctx, next);
			expect(count).to.equal(1);
		});

		it('should deeply call next middleware if no route', async () => {
			const d = new Dispatcher();
			const middleware = d.callback();
			const ctx = {
				method: 'GET',
				originalUrl: '/bar'
			};
			let count = 0;
			const next = () => {
				count++;
			};

			await middleware(ctx, next);
			expect(count).to.equal(1);
		});

		it('should dispatch POST request', async () => {
			const d = new Dispatcher();

			d.register('/foo', ctx => {
				// console.log(ctx.request);
				expect(ctx.request.foo).to.equal('bar');
				expect(ctx.headers).to.deep.equal({});
				expect(ctx.source).to.equal('http');
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

			await middleware(ctx, Promise.resolve);
			expect(ctx.body).to.be.a('string');
			expect(ctx.body).to.equal('foo!');
		});

		it('should ignore HEAD request', async () => {
			const d = new Dispatcher();
			let count = 0;
			let count2 = 0;

			d.register('/', () => {
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

			await middleware(ctx, next);
			expect(count).to.equal(1);
			expect(count2).to.equal(0);
		});

		it('should return 500 error if handler throws error', async () => {
			const d = new Dispatcher();

			d.register('/foo', () => {
				throw new Error('foo!');
			});

			const middleware = d.callback();
			const ctx = {
				method: 'GET',
				originalUrl: '/foo'
			};

			await middleware(ctx, Promise.resolve);
			expect(ctx.status).to.equal(500);
			expect(ctx.body).to.equal('Error: foo!');
		});

		it('should return dispatcher error', async () => {
			const d = new Dispatcher();

			d.register('/foo', () => {
				throw new DispatcherError(403, 'Not authorized!');
			});

			const middleware = d.callback();
			const ctx = {
				method: 'GET',
				originalUrl: '/foo'
			};

			await middleware(ctx, Promise.resolve);
			expect(ctx.status).to.equal(403);
			expect(ctx.body).to.equal('DispatcherError: Not authorized! (code 403)');
		});

		it('should return dispatcher error with null status', async () => {
			const d = new Dispatcher();

			d.register('/foo', () => {
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

			await middleware(ctx, Promise.resolve);
			expect(ctx.status).to.equal(500);
			expect(ctx.body).to.equal('DispatcherError: Not authorized! (code 403)');
		});

		it('should return a Response object', async () => {
			const d = new Dispatcher();

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

			await middleware(ctx, Promise.resolve);
			expect(ctx.status).to.equal(200);
			expect(ctx.body).to.be.a('string');
			expect(ctx.body).to.equal('OK');
		});

		it('should return a Response object with null status', async () => {
			const d = new Dispatcher();

			d.register('/foo', ctx => {
				ctx.response = new Response(codes.OK);
				ctx.response.status = null;
			});

			const middleware = d.callback();
			const ctx = {
				method: 'GET',
				originalUrl: '/foo'
			};

			await middleware(ctx, Promise.resolve);
			expect(ctx.status).to.equal(200);
			expect(ctx.body).to.be.a('string');
			expect(ctx.body).to.equal('OK');
		});

		it('should call onRequest callback', async () => {
			const d = new Dispatcher();

			let info;

			d.register('/foo', ctx => {
				ctx.response = 'foo!';
			});

			const middleware = d.callback(i => {
				info = i;
			});

			const ctx = {
				method: 'GET',
				originalUrl: '/foo'
			};

			await middleware(ctx, Promise.resolve);

			expect(info).to.be.an('object');
			expect(info.size).to.equal(4);
			expect(info.status).to.equal(200);
		});

		it('should stringify a object response', async () => {
			const d = new Dispatcher();
			d.register('/foo', ctx => {
				ctx.response = { foo: 'bar' };
			});

			const middleware = d.callback();
			const ctx = {
				method: 'GET',
				originalUrl: '/foo'
			};

			await middleware(ctx, Promise.resolve);

			expect(ctx.body).to.be.a('string');
			expect(ctx.body).to.equal('{"foo":"bar"}');
		});

		it('should stringify streamed objects', async () => {
			const d = new Dispatcher();
			d.register('/foo', ctx => {
				ctx.response.write({ foo: 'bar' });
				ctx.response.write({ baz: 'wiz' });
				ctx.response.end();
			});

			const middleware = d.callback();
			const ctx = {
				method: 'GET',
				originalUrl: '/foo'
			};

			await middleware(ctx, Promise.resolve);

			const out = new WritableStream();
			ctx.body.pipe(out);

			await new Promise((resolve, reject) => {
				ctx.body.on('end', () => {
					try {
						expect(out.toString()).to.equal('{"foo":"bar"}{"baz":"wiz"}');
						resolve();
					} catch (err) {
						reject(err);
					}
				});
			});
		});
	});

	describe('Root Dispatcher', () => {
		beforeEach(() => {
			Dispatcher.root.routes = [];
		});

		afterEach(() => {
			Dispatcher.root.routes = [];
		});

		it('should register handler and call it', async () => {
			let count = 0;

			Dispatcher.register('/foo', () => {
				count++;
			});

			await Dispatcher.call('/foo');
			expect(count).to.equal(1);
		});

		it('should register handler, unregister it, and call it', async () => {
			let count = 0;
			const handler = () => {
				count++;
			};

			Dispatcher.register([ '/foo' ], handler);

			Dispatcher.unregister([ '/foo' ], handler);

			try {
				await Dispatcher.call('/foo');
				throw new Error('Expected call to fail');
			} catch (e) {
				expect(count).to.equal(0);
			}
		});

		it('should dispatch GET request', async () => {
			Dispatcher.register('/foo', ctx => {
				ctx.response = 'foo!';
			});

			const middleware = Dispatcher.callback();
			const ctx = {
				method: 'GET',
				originalUrl: '/foo'
			};

			await middleware(ctx, Promise.resolve);
			expect(ctx.body).to.be.a('string');
			expect(ctx.body).to.equal('foo!');
		});

		it('should fail to set invalid root instance', () => {
			expect(() => {
				Dispatcher.root = 'foo';
			}).to.throw(TypeError, 'Root instance must be a Dispatcher type');
		});

		it('should set a new root instance', () => {
			const d = new Dispatcher();
			Dispatcher.root = d;
			expect(Dispatcher.root).to.equal(d);
		});
	});
});
