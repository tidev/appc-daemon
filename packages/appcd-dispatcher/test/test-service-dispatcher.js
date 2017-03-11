import Dispatcher from '../src/dispatcher';
import ServiceDispatcher from '../src/service-dispatcher';

import { codes, statuses } from '../src/statuses';

describe('ServiceDispatcher', () => {
	it('should fail if path is invalid', () => {
		expect(() => {
			new ServiceDispatcher();
		}).to.throw(TypeError, 'Expected path to be a string');

		expect(() => {
			new ServiceDispatcher('');
		}).to.throw(TypeError, 'Expected path to be a string');

		expect(() => {
			new ServiceDispatcher(123);
		}).to.throw(TypeError, 'Expected path to be a string');
	});

	it('should fail if instance is invalid', () => {
		expect(() => {
			new ServiceDispatcher('/foo');
		}).to.throw(TypeError, 'Expected instance to be an object');

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
					payload: {
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
						payload: {
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
						payload: {
							sessionId: 0,
							type: 'subscribe'
						},
						response: {
							once: () => {},
							write: response => {
								expect(response).to.deep.equal({
									status: codes.SUBSCRIBED,
									message: statuses[codes.SUBSCRIBED],
									topic: '/foo',
									type: 'subscribe'
								});
							}
						}
					}, () => Promise.resolve());

					expect(count).to.equal(1);
					done();
				})
				.catch(done);
		});

		it('should create a new subscriptions for multiple sessions', done => {
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
						payload: {
							sessionId: 0,
							type: 'subscribe'
						},
						response: {
							once: () => {},
							write: response => {
								expect(response).to.deep.equal({
									status: codes.SUBSCRIBED,
									message: statuses[codes.SUBSCRIBED],
									topic: '/foo',
									type: 'subscribe'
								});
							}
						}
					}, () => Promise.resolve());

					sd.handler({
						path: '/foo',
						payload: {
							sessionId: 1,
							type: 'subscribe'
						},
						response: {
							once: () => {},
							write: response => {
								expect(response).to.deep.equal({
									status: codes.SUBSCRIBED,
									message: statuses[codes.SUBSCRIBED],
									topic: '/foo',
									type: 'subscribe'
								});
							}
						}
					}, () => Promise.resolve());

					expect(count).to.equal(1);
					done();
				})
				.catch(done);
		});

		it('should only subscribe once per session', done => {
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
						payload: {
							sessionId: 0,
							type: 'subscribe'
						},
						response: {
							once: () => {},
							write: response => {
								expect(response).to.deep.equal({
									status: codes.SUBSCRIBED,
									message: statuses[codes.SUBSCRIBED],
									topic: '/foo',
									type: 'subscribe'
								});
							}
						}
					}, () => Promise.resolve());

					const ctx = {
						path: '/foo',
						payload: {
							sessionId: 0,
							type: 'subscribe'
						},
						response: {
							once: () => {},
							write: response => {}
						}
					};

					sd.handler(ctx, () => Promise.resolve());

					expect(ctx.status).to.equal(codes.ALREADY_SUBSCRIBED);
					expect(ctx.response).to.equal(statuses[codes.ALREADY_SUBSCRIBED]);
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
						payload: {
							sessionId: 0,
							type: 'subscribe'
						},
						response: {
							once: () => {},
							write: response => {
								if (count === 0) {
									expect(response).to.deep.equal({
										status: codes.SUBSCRIBED,
										message: statuses[codes.SUBSCRIBED],
										topic: '/foo',
										type: 'subscribe'
									});
								} else {
									expect(response).to.deep.equal({
										message: 'foo!',
										topic: '/foo'
									});
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
		it('should notify if not subscribed', done => {
			const sd = new ServiceDispatcher('/foo', {
				onUnsubscribe: (ctx, publish) => {}
			});

			Promise.resolve()
				.then(() => {
					const ctx = {
						path: '/foo',
						payload: {
							sessionId: 0,
							type: 'unsubscribe'
						},
						response: {
							once: () => {},
							write: response => {}
						}
					};

					sd.handler(ctx, () => Promise.resolve());

					expect(ctx.status).to.equal(codes.NOT_SUBSCRIBED);
					expect(ctx.response).to.equal(statuses[codes.NOT_SUBSCRIBED]);
					done();
				})
				.catch(done);
		});

		it('should unsubscribe and delete subscription topic', done => {
			const sd = new ServiceDispatcher('/foo', {
				onSubscribe: (ctx, publish) => {},
				onUnsubscribe: (ctx, publish) => {}
			});

			Promise.resolve()
				.then(() => {
					sd.handler({
						path: '/foo',
						payload: {
							sessionId: 0,
							type: 'subscribe'
						},
						response: {
							once: () => {},
							write: response => {
								expect(response).to.deep.equal({
									status: codes.SUBSCRIBED,
									message: statuses[codes.SUBSCRIBED],
									topic: '/foo',
									type: 'subscribe'
								});
							}
						}
					}, () => Promise.resolve());

					expect(Object.keys(sd.subscriptions['/foo'].sessions)).to.have.lengthOf(1);

					let ctx = {
						path: '/foo',
						payload: {
							sessionId: 0,
							type: 'unsubscribe'
						},
						response: {
							once: () => {},
							write: response => {}
						}
					};

					sd.handler(ctx, () => Promise.resolve());

					expect(ctx.status).to.equal(codes.UNSUBSCRIBED);
					expect(ctx.response).to.equal(statuses[codes.UNSUBSCRIBED]);
					expect(Object.keys(sd.subscriptions)).to.have.lengthOf(0);
					done();
				})
				.catch(done);
		});

		it('should unsubscribe for one sessions', done => {
			const sd = new ServiceDispatcher('/foo', {
				onSubscribe: (ctx, publish) => {},
				onUnsubscribe: (ctx, publish) => {}
			});

			Promise.resolve()
				.then(() => {
					sd.handler({
						path: '/foo',
						payload: {
							sessionId: 0,
							type: 'subscribe'
						},
						response: {
							once: () => {},
							write: response => {
								expect(response).to.deep.equal({
									status: codes.SUBSCRIBED,
									message: statuses[codes.SUBSCRIBED],
									topic: '/foo',
									type: 'subscribe'
								});
							}
						}
					}, () => Promise.resolve());

					sd.handler({
						path: '/foo',
						payload: {
							sessionId: 1,
							type: 'subscribe'
						},
						response: {
							once: () => {},
							write: response => {
								expect(response).to.deep.equal({
									status: codes.SUBSCRIBED,
									message: statuses[codes.SUBSCRIBED],
									topic: '/foo',
									type: 'subscribe'
								});
							}
						}
					}, () => Promise.resolve());

					let ctx = {
						path: '/foo',
						payload: {
							sessionId: 0,
							type: 'unsubscribe'
						},
						response: {
							once: () => {},
							write: response => {}
						}
					};

					sd.handler(ctx, () => Promise.resolve());

					expect(ctx.status).to.equal(codes.UNSUBSCRIBED);
					expect(ctx.response).to.equal(statuses[codes.UNSUBSCRIBED]);

					ctx = {
						path: '/foo',
						payload: {
							sessionId: 0,
							type: 'unsubscribe'
						},
						response: {
							once: () => {},
							write: response => {}
						}
					};

					sd.handler(ctx, () => Promise.resolve());

					expect(ctx.status).to.equal(codes.NOT_SUBSCRIBED);
					expect(ctx.response).to.equal(statuses[codes.NOT_SUBSCRIBED]);
					done();
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
						payload: {
							sessionId: 0,
							type: 'subscribe'
						},
						response: {
							once: (evt, fn) => {
								unsub[evt] = fn;
							},
							write: response => {
								expect(response).to.deep.equal({
									status: codes.SUBSCRIBED,
									message: statuses[codes.SUBSCRIBED],
									topic: '/foo',
									type: 'subscribe'
								});
							}
						}
					}, () => Promise.resolve());

					expect(Object.keys(sd.subscriptions['/foo'].sessions)).to.have.lengthOf(1);
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
						payload: {
							sessionId: 0,
							type: 'subscribe'
						},
						response: {
							once: (evt, fn) => {
								unsub[evt] = fn;
							},
							write: response => {
								expect(response).to.deep.equal({
									status: codes.SUBSCRIBED,
									message: statuses[codes.SUBSCRIBED],
									topic: '/foo',
									type: 'subscribe'
								});
							}
						}
					}, () => Promise.resolve());

					expect(Object.keys(sd.subscriptions['/foo'].sessions)).to.have.lengthOf(1);
					unsub.error();

					expect(Object.keys(sd.subscriptions)).to.have.lengthOf(0);
					done();
				})
				.catch(done);
		});
	});
});
