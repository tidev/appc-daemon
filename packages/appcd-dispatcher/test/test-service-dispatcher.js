import Dispatcher from '../dist/dispatcher';
import ServiceDispatcher from '../dist/service-dispatcher';

import Response, { codes, loadMessage } from 'appcd-response';

describe('ServiceDispatcher', () => {
	it('should fail if path is invalid', () => {
		expect(() => {
			new ServiceDispatcher(123);
		}).to.throw(TypeError, 'Expected path to be a string');
	});

	it('should fail if instance is invalid', () => {
		expect(() => {
			new ServiceDispatcher('/foo', '');
		}).to.throw(TypeError, 'Expected instance to be an object');

		expect(() => {
			new ServiceDispatcher('/foo', 123);
		}).to.throw(TypeError, 'Expected instance to be an object');
	});

	describe('call', () => {
		it('should invoke handler', done => {
			const sd = new ServiceDispatcher('/foo', {});

			Promise.resolve()
				.then(() => sd.handler({}, () => Promise.resolve()))
				.then(() => done())
				.catch(done);
		});

		it('should invoke handler without leading slash', done => {
			const sd = new ServiceDispatcher('foo', {});

			Promise.resolve()
				.then(() => sd.handler({}, () => Promise.resolve()))
				.then(() => done())
				.catch(done);
		});

		it('should invoke service with call handler', done => {
			let count = 0;
			const sd = new ServiceDispatcher('/foo', {
				onCall: ctx => {
					count++;
				}
			});

			Promise.resolve()
				.then(() => sd.handler({}, () => Promise.resolve()))
				.then(() => {
					expect(count).to.equal(1);
					done();
				})
				.catch(done);
		});

		it('should invoke service with call handler with explicit type', done => {
			let count = 0;
			const sd = new ServiceDispatcher('/foo', {
				onCall: ctx => {
					count++;
				}
			});

			Promise.resolve()
				.then(() => sd.handler({
					request: {
						type: 'call'
					}
				}, () => Promise.resolve()))
				.then(() => {
					expect(count).to.equal(1);
					done();
				})
				.catch(done);
		});

		it('should error if type is invalid', done => {
			const sd = new ServiceDispatcher('/foo', {});

			Promise.resolve()
				.then(() => {
					sd.handler({
						request: {
							type: 'foo'
						}
					}, () => Promise.resolve());
				})
				.then(() => {
					done(new Error('Expected type "foo" to be invalid'));
				})
				.catch(err => {
					expect(err.message).to.equal('Invalid service handler type "foo"');
					done();
				})
				.catch(done);
		});

		it('should invoke service that doesn\'t have a path', done => {
			let count = 0;
			const sd = new ServiceDispatcher({
				onCall: ctx => {
					count++;
				}
			});

			Promise.resolve()
				.then(() => sd.handler({}, () => Promise.resolve()))
				.then(() => {
					expect(count).to.equal(1);
					done();
				})
				.catch(done);
		});
	});

	describe('subscribe', () => {
		it('should create a new subscription', done => {
			let count = 0;
			const sd = new ServiceDispatcher('/foo', {
				onSubscribe: (ctx, publish) => {
					count++;
				}
			});

			Promise.resolve()
				.then(() => {
					sd.handler({
						path: '/foo',
						realPath: '/foo',
						request: {
							type: 'subscribe'
						},
						response: {
							once: () => {},
							write: response => {
								expect(response.message).to.be.instanceof(Response);
								expect(response.message.toString()).to.equal('Subscribed');
								expect(response.message.status).to.equal(201);
								expect(response.topic).to.equal('/foo');
								expect(response.type).to.equal('subscribe');
							}
						}
					}, () => Promise.resolve());

					expect(count).to.equal(1);
					done();
				})
				.catch(done);
		});

		it('should create a new subscriptions for multiple subs', done => {
			let count = 0;
			const sd = new ServiceDispatcher('/foo', {
				onSubscribe: (ctx, publish) => {
					count++;
				}
			});

			Promise.resolve()
				.then(() => {
					sd.handler({
						path: '/foo',
						realPath: '/foo',
						request: {
							type: 'subscribe'
						},
						response: {
							once: () => {},
							write: response => {
								expect(response.message).to.be.instanceof(Response);
								expect(response.message.toString()).to.equal('Subscribed');
								expect(response.message.status).to.equal(201);
								expect(response.topic).to.equal('/foo');
								expect(response.type).to.equal('subscribe');
							}
						}
					}, () => Promise.resolve());

					sd.handler({
						path: '/foo',
						realPath: '/foo',
						request: {
							type: 'subscribe'
						},
						response: {
							once: () => {},
							write: response => {
								expect(response.message).to.be.instanceof(Response);
								expect(response.message.toString()).to.equal('Subscribed');
								expect(response.message.status).to.equal(201);
								expect(response.topic).to.equal('/foo');
								expect(response.type).to.equal('subscribe');
							}
						}
					}, () => Promise.resolve());

					expect(count).to.equal(1);
					done();
				})
				.catch(done);
		});

		it('should publish message to subscriber', done => {
			let count = 0;
			const sd = new ServiceDispatcher('/foo', {
				onSubscribe: (ctx, publish) => {
					setImmediate(() => {
						count++;
						publish('foo!');
					});
				}
			});

			Promise.resolve()
				.then(() => new Promise((resolve, reject) => {
					sd.handler({
						path: '/foo',
						realPath: '/foo',
						request: {
							type: 'subscribe'
						},
						response: {
							once: () => {},
							write: response => {
								if (count === 0) {
									expect(response.message).to.be.instanceof(Response);
									expect(response.message.toString()).to.equal('Subscribed');
									expect(response.message.status).to.equal(201);
									expect(response.topic).to.equal('/foo');
									expect(response.type).to.equal('subscribe');
								} else {
									expect(response.message).to.equal('foo!');
									expect(response.topic).to.equal('/foo');
									expect(response.type).to.equal('event');
									resolve();
								}
							}
						}
					}, () => Promise.resolve());
				}))
				.then(() => {
					expect(count).to.equal(1);
					done();
				})
				.catch(done);
		});
	});

	describe('unsubscribe', () => {
		it('should error if missing subscription id', done => {
			const sd = new ServiceDispatcher('/foo', {
				onUnsubscribe: (ctx, publish) => {}
			});

			Promise.resolve()
				.then(() => {
					const ctx = {
						path: '/foo',
						request: {
							type: 'unsubscribe'
						},
						response: {
							once: () => {},
							write: response => {}
						}
					};

					sd.handler(ctx, () => Promise.resolve());

					expect(ctx.response).to.be.instanceof(Response);
					expect(ctx.response.toString()).to.equal('Missing Subscription ID');
					expect(ctx.response.status).to.equal(400);
					done();
				})
				.catch(done);
		});

		it('should notify if not subscribed', done => {
			const sd = new ServiceDispatcher('/foo', {
				onUnsubscribe: (ctx, publish) => {}
			});

			Promise.resolve()
				.then(() => {
					const ctx = {
						path: '/foo',
						request: {
							sid: 'foo',
							type: 'unsubscribe'
						},
						response: {
							once: () => {},
							write: response => {}
						}
					};

					sd.handler(ctx, () => Promise.resolve());

					expect(ctx.response).to.be.instanceof(Response);
					expect(ctx.response.toString()).to.equal('Not Subscribed');
					expect(ctx.response.status).to.equal(404);
					done();
				})
				.catch(done);
		});

		it('should unsubscribe and delete subscription topic', done => {
			const sd = new ServiceDispatcher('/foo', {
				onSubscribe: (ctx, publish) => {},
				onUnsubscribe: (ctx, publish) => {}
			});

			let counter = 0;

			Promise.resolve()
				.then(() => {
					sd.handler({
						path: '/foo',
						realPath: '/foo',
						request: {
							type: 'subscribe'
						},
						response: {
							once: () => {},
							write: response => {
								switch (++counter) {
									case 1:
										expect(response.message).to.be.instanceof(Response);
										expect(response.message.toString()).to.equal('Subscribed');
										expect(response.message.status).to.equal(201);
										expect(response.topic).to.equal('/foo');
										expect(response.type).to.equal('subscribe');

										expect(Object.keys(sd.subscriptions['/foo'].subs)).to.have.lengthOf(1);

										let ctx = {
											path: '/foo',
											realPath: '/foo',
											request: {
												sid: response.sid,
												type: 'unsubscribe'
											},
											response: {
												once: () => {},
												write: response => {}
											}
										};

										sd.handler(ctx, () => Promise.resolve());

										expect(ctx.response).to.be.instanceof(Response);
										expect(ctx.response.toString()).to.equal('Unsubscribed');
										expect(ctx.response.status).to.equal(200);
										expect(ctx.response.statusCode).to.equal(codes.UNSUBSCRIBED);
										expect(Object.keys(sd.subscriptions)).to.have.lengthOf(0);
										break;

									case 2:
										expect(response.message).to.be.instanceof(Response);
										expect(response.message.toString()).to.equal('Unsubscribed');
										expect(response.message.status).to.equal(200);
										expect(response.topic).to.equal('/foo');
										expect(response.type).to.equal('unsubscribe');
										done();
										break;
								}
							}
						}
					}, () => Promise.resolve());
				})
				.catch(done);
		});

		it('should unsubscribe if stream closes', done => {
			const sd = new ServiceDispatcher('/foo', {
				onSubscribe: (ctx, publish) => {},
				onUnsubscribe: (ctx, publish) => {}
			});

			Promise.resolve()
				.then(() => {
					let unsub = {};

					sd.handler({
						path: '/foo',
						realPath: '/foo',
						request: {
							type: 'subscribe'
						},
						response: {
							once: (evt, fn) => {
								unsub[evt] = fn;
							},
							write: response => {
								expect(response.message).to.be.instanceof(Response);
								expect(response.message.toString()).to.equal('Subscribed');
								expect(response.message.status).to.equal(201);
								expect(response.topic).to.equal('/foo');
								expect(response.type).to.equal('subscribe');
							}
						}
					}, () => Promise.resolve());

					expect(Object.keys(sd.subscriptions['/foo'].subs)).to.have.lengthOf(1);
					unsub.end();

					expect(Object.keys(sd.subscriptions)).to.have.lengthOf(0);
					done();
				})
				.catch(done);
		});

		it('should unsubscribe if stream errors', done => {
			const sd = new ServiceDispatcher('/foo', {
				onSubscribe: (ctx, publish) => {},
				onUnsubscribe: (ctx, publish) => {}
			});

			Promise.resolve()
				.then(() => {
					let unsub = {};

					sd.handler({
						path: '/foo',
						realPath: '/foo',
						request: {
							type: 'subscribe'
						},
						response: {
							once: (evt, fn) => {
								unsub[evt] = fn;
							},
							write: response => {
								expect(response.message).to.be.instanceof(Response);
								expect(response.message.toString()).to.equal('Subscribed');
								expect(response.message.status).to.equal(201);
								expect(response.topic).to.equal('/foo');
								expect(response.type).to.equal('subscribe');
							}
						}
					}, () => Promise.resolve());

					expect(Object.keys(sd.subscriptions['/foo'].subs)).to.have.lengthOf(1);
					unsub.error();

					expect(Object.keys(sd.subscriptions)).to.have.lengthOf(0);
					done();
				})
				.catch(done);
		});
	});
});
