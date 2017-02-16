/**
 * Test cases from koa-66.
 * https://github.com/menems/koa-66
 * The MIT License (MIT)
 * Copyright (c) 2015 blaz
 */

import Koa from 'koa';
import request from 'supertest';
import Router, { methods } from '../src/router';

describe('router', () => {
	describe('core', () => {
		it('middleware must be present', done => {
			const router = new Router();
			try {
				router.get('/');
				done(new Error('Expected an error'));
			} catch (e) {
				expect(e.message).to.equal('Expected middleware to be a function');
				done();
			}
		});

		it('middleware must be a function', done => {
			const router = new Router();
			try {
				router.get('/', 42);
				done(new Error('Expected an error'));
			} catch (e) {
				expect(e.message).to.equal('Expected middleware to be a function');
				done();
			}
		});

		it('.routes() should be a valid middleware factory', done => {
			const router = new Router();
			expect(router.routes).to.be.a.function;
			const middleware = router.routes();
			expect(middleware).to.be.ok;
			expect(middleware).to.be.a.function;
			done();
		});

		it('200 with valid path and body', done => {
			const app = new Koa();
			const router = new Router();

			router.get('/hello', ctx => ctx.body = 'world');

			app.use(router.routes());

			const server = app.listen();
			request(server)
				.get('/hello')
				.expect(200)
				.expect('world')
				.end(err => {
					server.close();
					done(err);
				});
		});

		it('no routes should return 404', done => {
			const app = new Koa();
			const router = new Router();

			app.use(router.routes());

			const server = app.listen();
			request(server)
				.get('/hello')
				.expect(404)
				.end(err => {
					server.close();
					done(err);
				});
		});

		it('use without path should be apply to all router object methods', done => {
			const app = new Koa();
			const router = new Router();

			router.use((ctx, next) => {
				ctx.body = 'wor';
				next();
			});

			router.get('/hello', ctx => ctx.body += 'ld');

			app.use(router.routes());

			const server = app.listen();
			request(server)
				.get('/hello')
				.expect(200)
				.expect('world')
				.end(err => {
					server.close();
					done(err);
				});
		});

		it('should resolve next koa middleware', done => {
			const app = new Koa();
			const router = new Router();

			app.use((ctx, next) => {
				ctx.body = '1';
				return next().then(result => ctx.body += result);
			});

			router.get('/', (ctx, next) => {
				ctx.body += '2';
				return next();
			});

			app.use(router.routes());

			app.use(ctx => {
				ctx.body += '3';
				return '4';
			});

			const server = app.listen();
			request(server)
				.get('/')
				.expect(200)
				.expect('1234')
				.end(err => {
					server.close();
					done(err);
				});
		});

		it('it should resolve with value', done => {
			const app = new Koa();
			const router = new Router();

			app.use((ctx, next) => {
				ctx.body = '1';
				return next().then(result => ctx.body += result);
			});

			router.get('/', ctx => {
				ctx.body += '2';
				return Promise.resolve('3');
			});

			app.use(router.routes());

			const server = app.listen();
			request(server)
				.get('/')
				.expect(200)
				.expect('123')
				.end(err => {
					server.close();
					done(err);
				});
		});
	});

	describe('methods()', () => {
		methods.forEach(m => {
			it(`should work with ${m}`, done => {
				const app = new Koa();
				const router = new Router();

				router[m]('/hello', ctx => ctx.body = 'world');

				app.use(router.routes());

				const server = app.listen();
				request(server)[m]('/hello')
					.expect(200)
					.expect(m === 'head' ? '' : 'world')
					.end(err => {
						server.close();
						done(err);
					});
			});
		});

		methods.forEach(m => {
			it(`should work with ${m} and no path`, done => {
				const app = new Koa();
				const router = new Router();

				router[m](ctx => ctx.body = 'world');

				app.use(router.routes());

				const server = app.listen();
				request(server)[m]('/')
					.expect(200)
					.expect(m === 'head' ? '' : 'world')
					.end(err => {
						server.close();
						done(err);
					});
			});
		});

		it('should work with all', done => {
			const app = new Koa();
			const router = new Router();
			let remained = methods.length;

			router.all('/hello', ctx => ctx.body = 'world');

			app.use(router.routes());

			methods.forEach(m => {
				const server = app.listen();
				request(server)[m]('/hello')
					.expect(200)
					.expect(m === 'head' ? '' : 'world')
					.end(err => {
						server.close();
						if (err) {
							done(err);
						} else if (--remained === 0) {
							done();
						}
					});
			});
		});

		it('should work with all without path', done => {
			const app = new Koa();
			const router = new Router();
			let remained = methods.length;

			router.all(ctx => ctx.body = 'world');

			app.use(router.routes());

			methods.forEach(m => {
				const server = app.listen();
				request(server)[m]('/')
					.expect(200)
					.expect(m === 'head' ? '' : 'world')
					.end(err => {
						server.close();
						if (err) {
							done(err);
						} else if (--remained === 0) {
							done();
						}
					});
			});
		});
	});

	describe('use()', () => {
		it('should throw if no a koa-66 instance', () => {
			const router = new Router();
			expect(() => router.use('/', 1)).to.throw('Expected middleware to be a function');
		});

		it('should 200 with correct path', done => {
			const app = new Koa();
			const router = new Router();
			const router2 = new Router();

			router.get('/', ctx => ctx.body = 'world');

			router2.use('/hello', router);

			app.use(router2.routes());

			const server = app.listen();
			request(server)
				.get('/hello')
				.expect(200)
				.expect('world')
				.end(err => {
					server.close();
					done(err);
				});
		});

		it('should mount nested routes', done => {
			const app = new Koa();
			const rootRouter = new Router();
			const apiRouter = new Router();
			const router = new Router();

			router.get('/:id', ctx => {
				ctx.body = 'world';
				expect(ctx.route.path).to.equal('/api/v1/ticket/:id');
			});

			apiRouter.use('/ticket', router);
			rootRouter.use('/api/v1', apiRouter);
			// must be the last
			app.use(rootRouter.routes());

			const server = app.listen();
			request(server)
				.get('/api/v1/ticket/66')
				.expect(200)
				.expect('world')
				.end(err => {
					server.close();
					done(err);
				});
		});

		it('should 404 with old path', done => {
			const app = new Koa();
			const router = new Router();
			const router2 = new Router();

			router.get('/', ctx => ctx.body = 'world');

			router2.use('/hello', router);

			app.use(router2.routes());

			const server = app.listen();
			request(server)
				.get('/')
				.expect(404)
				.end(err => {
					server.close();
					done(err);
				});
		});

		it('should be apply only on children', done => {
			const app = new Koa();
			const router = new Router();
			const router2 = new Router();

			router.use((ctx, next) => {
				ctx.body = 'hello';
				next();
			});

			router.get('/', ctx => ctx.body += 'world');

			router2.use('/hello', router);

			app.use(router2.routes());

			const server = app.listen();
			request(server)
				.get('/hello')
				.expect(200)
				.expect('helloworld')
				.end(err => {
					server.close();
					done(err);
				});
		});

		it('should be apply only on children 2', done => {
			const app = new Koa();
			const router = new Router();
			const router2 = new Router();

			router.use((ctx, next) => {
				ctx.body = 'hello';
				next();
			});

			router.get('/', ctx => ctx.body += 'world');
			router2.get('/', ctx => ctx.body += 'pouet');

			router2.use('/hello', router);

			app.use(router2.routes());

			const server = app.listen();
			request(server)
				.get('/')
				.expect(200)
				.expect('undefinedpouet')
				.end(err => {
					server.close();
					done(err);
				});
		});
	});

	describe('URL parameters', () => {
		it('url params', done => {
			const app = new Koa();
			const router = new Router();
			const router2 = new Router();

			router.get('/:two/test', ctx => ctx.body = ctx.params);

			router2.use('/:one', router);

			app.use(router2.routes());

			const server = app.listen();
			request(server)
				.get('/one/two/test')
				.expect(200)
				.expect({
					one: 'one',
					two: 'two'
				})
				.end(err => {
					server.close();
					done(err);
				});
		});
	});

	describe('multiple middleware', () => {
		it('200 with complete body and multiple routes', done => {
			const app = new Koa();
			const router = new Router();

			router.get('/hello', (ctx, next) => {
				ctx.body = 'wor';
				next();
			});

			router.get('/hello', ctx => ctx.body += 'ld');

			app.use(router.routes());

			const server = app.listen();
			request(server)
				.get('/hello')
				.expect(200)
				.expect('world')
				.end(err => {
					server.close();
					done(err);
				});
		});

		it('multiple routes without next should stop', done => {
			const app = new Koa();
			const router = new Router();

			router.get('/hello', ctx => ctx.body = 'wor');
			router.get('/hello', ctx => ctx.body += 'ld');

			app.use(router.routes());

			const server = app.listen();
			request(server)
				.get('/hello')
				.expect(200)
				.expect('wor')
				.end(err => {
					server.close();
					done(err);
				});
		});

		it('multiple routes with next', done => {
			const app = new Koa();
			const router = new Router();

			router.get('/', (ctx, next) => {
				ctx.body = 'hello';
				next();
			});
			router.get('/', ctx => ctx.body += 'world');

			app.use(router.routes());

			const server = app.listen();
			request(server)
				.get('/')
				.expect(200)
				.expect('helloworld')
				.end(err => {
					server.close();
					done(err);
				});
		});
	});

	describe('HEAD, OPTIONS, 501 and 405', () => {
		it('should return 501 on not implemented methods', done => {
			const app = new Koa();
			const router = new Router();

			router.get('/', () => {});
			app.use(router.routes());

			const server = app.listen();
			request(server)
				.search('/')
				.expect(501)
				.end(err => {
					server.close();
					done(err);
				});
		});

		it('should return 405 on not allowed method', done => {
			const app = new Koa();
			const router = new Router();

			router.use(() => {});
			router.get('/', () => {});
			router.get('/', () => {});
			router.put('/', () => {});
			app.use(router.routes());

			const server = app.listen();
			request(server)
				.post('/')
				.expect(405)
				.end((err, res) => {
					server.close();
					if (err) {
						return done(err);
					}
					expect(res.header).to.have.property('allow');
					expect(res.header.allow).to.equal('GET, HEAD, PUT');
					done();
				});
		});

		it('if no HEAD method registered and have GET should 200', done => {
			const app = new Koa();
			const router = new Router();

			router.get('/', ctx => ctx.body = 'pouet');
			app.use(router.routes());

			const server = app.listen();
			request(server)
				.head('/')
				.expect(200)
				.end(err => {
					server.close();
					done(err);
				});
		});

		it('options methods has to respond with 204', done => {
			const app = new Koa();
			const router = new Router();

			router.get('/', ctx => ctx.body = 'pouet');
			app.use(router.routes());

			const server = app.listen();
			request(server)
				.options('/')
				.expect(204)
				.end(err => {
					server.close();
					done(err);
				});
		});
	});

	describe('param()', () => {
		it('should throw if key is not a string', () => {
			const router = new Router();
			expect(() => router.param()).to.throw('Expected key to be a string');
		});

		it('should throw if fn is not a function', () => {
			const router = new Router();
			expect(() => router.param('')).to.throw('Expected fn to be a function');
		});

		it('should resolve param', done => {
			const app = new Koa();
			const router = new Router();

			router.param('id', (ctx, next, id) => {
				ctx.test = id;
				next();
			});

			router.get('/:id', ctx => ctx.body = ctx.test);
			app.use(router.routes());

			const server = app.listen();
			request(server)
				.get('/pouet')
				.expect(200)
				.expect('pouet')
				.end(err => {
					server.close();
					done(err);
				});
		});

		it('should not resolve param', done => {
			const app = new Koa();
			const router = new Router();

			router.param('idc', (ctx, next, id) => {
				ctx.test = id;
				next();
			});

			router.get('/:id', ctx => ctx.body = ctx.test);
			app.use(router.routes());

			const server = app.listen();
			request(server)
				.get('/pouet')
				.expect(204)
				.end(err => {
					server.close();
					done(err);
				});
		});

		it('runs parent parameter middleware for subrouter', done => {
			const app = new Koa();
			const router = new Router();
			const subrouter = new Router();

			subrouter.get('/:cid', ctx => {
				ctx.body = {
					id: ctx.a,
					cid: ctx.params.cid
				};
			});

			router
				.param('id', (ctx, next, id) => {
					ctx.a = id;
					next();
				})
				.use('/:id/children', subrouter);

			app.use(router.routes());

			const server = app.listen();
			request(server)
				.get('/pouet/children/2')
				.expect(200)
				.expect({
					id: 'pouet',
					cid: '2'
				})
				.end(err => {
					server.close();
					done(err);
				});
		});

		it('runs children parameter middleware for subrouter', done => {
			const app = new Koa();
			const router = new Router();
			const subrouter = new Router();

			subrouter
				.param('cid', (ctx, next, cid) => {
					ctx.b = cid;
					next();
				})
				.get('/:cid', ctx => {
					ctx.body = {
						id: ctx.a,
						cid: ctx.b
					};
				});

			router
				.param('id', (ctx, next, id) => {
					ctx.a = id;
					next();
				})
				.use('/:id/children', subrouter);

			app.use(router.routes());

			const server = app.listen();
			request(server)
				.get('/pouet/children/2')
				.expect(200)
				.expect({
					id: 'pouet',
					cid: '2'
				})
				.end(err => {
					server.close();
					done(err);
				});
		});

		it('runs parameter middleware in order of URL appearance', done => {
			const app = new Koa();
			const router = new Router();
			router
				.param('user', (ctx, next) => {
					ctx.user = {
						name: 'alex'
					};
					if (ctx.ranFirst)  {
						ctx.user.ordered = 'parameters';
					}
					next();
				})
				.param('first', (ctx, next) => {
					ctx.ranFirst = true;
					if (ctx.user) {
						ctx.ranFirst = false;
					}
					next();
				})
				.get('/:first/users/:user', ctx => {
					ctx.body = ctx.user;
				});

			app.use(router.routes());

			const server = app.listen();
			request(server)
				.get('/first/users/3')
				.expect(200)
				.expect({
					name: 'alex',
					ordered: 'parameters'
				})
				.end(err => {
					server.close();
					done(err);
				});
		});

		it('doesn\'t run parameter middleware if path matched does not have a parameter', done => {
			const app = new Koa();
			const router = new Router();
			router.param('id', (ctx, next, id) => {
				ctx.ranParam = 'true';
				next();
			});

			router.get('/test', ctx => {
				ctx.body = ctx.ranParam || 'false';
			});
			router.get('/:id', ctx => {
				ctx.body = ctx.ranParam || 'false';
			});
			app.use(router.routes());

			let server = app.listen();
			request(server)
				.get('/test')
				.expect(200)
				.expect('false')
				.end(err => {
					server.close();
					if (err) {
						return done(err);
					}
					server = app.listen();
					request(server)
						.get('/not-test')
						.expect(200)
						.expect('true')
						.end(err => {
							server.close();
							done(err);
						});
				});
		});
	});
});
