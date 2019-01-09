import Response, { codes } from 'appcd-response';
import ServiceDispatcher from '../dist/service-dispatcher';

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
		it('should invoke handler', async () => {
			const sd = new ServiceDispatcher('/foo', {});

			await sd.handler({}, () => Promise.resolve());
		});

		it('should invoke handler without leading slash', async () => {
			const sd = new ServiceDispatcher('foo', {});

			await sd.handler({}, () => Promise.resolve());
		});

		it('should invoke service with call handler', async () => {
			let count = 0;
			const sd = new ServiceDispatcher('/foo', {
				onCall() {
					count++;
				}
			});

			await sd.handler({}, () => Promise.resolve());

			expect(count).to.equal(1);
		});

		it('should invoke service with call handler with explicit type', async () => {
			let count = 0;
			const sd = new ServiceDispatcher('/foo', {
				onCall() {
					count++;
				}
			});

			await sd.handler({
				request: {
					type: 'call'
				}
			}, () => Promise.resolve());

			expect(count).to.equal(1);
		});

		it('should error if type is invalid', async () => {
			const sd = new ServiceDispatcher('/foo', {});

			try {
				await sd.handler({
					request: {
						type: 'foo'
					}
				}, () => Promise.resolve());
			} catch (err) {
				expect(err.message).to.equal('Invalid service handler type "foo"');
				return;
			}

			throw new Error('Expected type "foo" to be invalid');
		});

		it('should invoke service that doesn\'t have a path', async () => {
			let count = 0;
			const sd = new ServiceDispatcher({
				onCall() {
					count++;
				}
			});

			await sd.handler({}, () => Promise.resolve());

			expect(count).to.equal(1);
		});
	});

	describe('subscribe', () => {
		it('should create a new subscription', async () => {
			let count = 0;
			const sd = new ServiceDispatcher('/foo', {
				onSubscribe() {
					count++;
				}
			});

			sd.handler({
				path: '/foo',
				realPath: '/foo',
				request: {
					type: 'subscribe'
				},
				response: {
					end() {
						// noop
					},
					once() {
						// noop
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

			expect(count).to.equal(1);
		});

		it('should create a new subscriptions for multiple subs', async () => {
			const fns = [];
			const sd = new ServiceDispatcher('/foo', {
				onSubscribe({ publish }) {
					fns.push(publish);
				}
			});

			await sd.handler({
				path: '/foo',
				realPath: '/foo',
				request: {
					type: 'subscribe'
				},
				response: {
					end() {
						// noop
					},
					once() {
						// noop
					},
					write(response) {
						expect(response.message).to.be.instanceof(Response);
						expect(response.message.toString()).to.equal('Subscribed');
						expect(response.message.status).to.equal(201);
						expect(response.topic).to.equal('/foo');
						expect(response.type).to.equal('subscribe');
					}
				}
			}, () => Promise.resolve());

			await sd.handler({
				path: '/foo',
				realPath: '/foo',
				request: {
					type: 'subscribe'
				},
				response: {
					end() {
						// noop
					},
					once() {
						// noop
					},
					write(response) {
						expect(response.message).to.be.instanceof(Response);
						expect(response.message.toString()).to.equal('Subscribed');
						expect(response.message.status).to.equal(201);
						expect(response.topic).to.equal('/foo');
						expect(response.type).to.equal('subscribe');
					}
				}
			}, () => Promise.resolve());

			expect(fns).to.have.lengthOf(2);
			expect(fns[0]).to.not.equal(fns[1]);
		});

		it('should publish message to subscriber', async () => {
			let count = 0;
			const sd = new ServiceDispatcher('/foo', {
				onSubscribe({ publish }) {
					setImmediate(() => {
						count++;
						publish('foo!');
					});
				}
			});

			await new Promise((resolve, reject) => {
				sd.handler({
					path: '/foo',
					realPath: '/foo',
					request: {
						type: 'subscribe'
					},
					response: {
						end() {
							// noop
						},
						once() {
							// noop
						},
						write(response) {
							try {
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
							} catch (err) {
								reject(err);
							}
						}
					}
				}, () => Promise.resolve());
			});

			expect(count).to.equal(1);
		});
	});

	describe('unsubscribe', () => {
		it('should error if missing subscription id', async () => {
			const sd = new ServiceDispatcher('/foo', {
				initSubscription() {
					// noop
				},
				onSubscribe() {
					// noop
				},
				onUnsubscribe() {
					// noop
				},
				destroySubscription() {
					// noop
				}
			});

			const ctx = {
				path: '/foo',
				request: {
					type: 'unsubscribe'
				},
				response: {
					end() {
						// noop
					},
					once() {
						// noop
					},
					write() {
						// noop
					}
				}
			};

			sd.handler(ctx, () => Promise.resolve());

			expect(ctx.response).to.be.instanceof(Response);
			expect(ctx.response.toString()).to.equal('Missing Subscription ID');
			expect(ctx.response.status).to.equal(400);
		});

		it('should notify if not subscribed', async () => {
			const sd = new ServiceDispatcher('/foo', {
				initSubscription() {
					// noop
				},
				onSubscribe() {
					// noop
				},
				onUnsubscribe() {
					// noop
				},
				destroySubscription() {
					// noop
				}
			});

			const ctx = {
				path: '/foo',
				request: {
					sid: 'foo',
					type: 'unsubscribe'
				},
				response: {
					end() {
						// noop
					},
					once() {
						// noop
					},
					write() {
						// noop
					}
				}
			};

			sd.handler(ctx, () => Promise.resolve());

			expect(ctx.response).to.be.instanceof(Response);
			expect(ctx.response.toString()).to.equal('Not Subscribed');
			expect(ctx.response.status).to.equal(404);
		});

		it('should unsubscribe and delete subscription topic', async () => {
			const sd = new ServiceDispatcher('/foo', {
				initSubscription() {
					// noop
				},
				onSubscribe() {
					// noop
				},
				onUnsubscribe() {
					// noop
				},
				destroySubscription() {
					// noop
				}
			});

			let counter = 0;

			await new Promise((resolve, reject) => {
				sd.handler({
					path: '/foo',
					realPath: '/foo',
					request: {
						type: 'subscribe'
					},
					response: {
						end() {
							// noop
						},
						once() {
							// noop
						},
						write(response) {
							try {
								switch (++counter) {
									case 1:
										expect(response.message).to.be.instanceof(Response);
										expect(response.message.toString()).to.equal('Subscribed');
										expect(response.message.status).to.equal(201);
										expect(response.topic).to.equal('/foo');
										expect(response.type).to.equal('subscribe');

										expect(sd.topics['/foo'].subs.size).to.equal(1);

										let ctx = {
											path: '/foo',
											realPath: '/foo',
											request: {
												sid: response.sid,
												type: 'unsubscribe'
											},
											response: {
												end() {
													// noop
												},
												once() {
													// noop
												},
												write() {
													// noop
												}
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
										resolve();
										break;
								}
							} catch (err) {
								reject(err);
							}
						}
					}
				}, () => Promise.resolve());
			});
		});

		it('should unsubscribe if stream closes', async () => {
			const sd = new ServiceDispatcher('/foo', {
				initSubscription() {
					// noop
				},
				onSubscribe() {
					// noop
				},
				onUnsubscribe() {
					// noop
				},
				destroySubscription() {
					// noop
				}
			});

			let unsub = {};

			sd.handler({
				path: '/foo',
				realPath: '/foo',
				request: {
					type: 'subscribe'
				},
				response: {
					once(evt, fn) {
						unsub[evt] = fn;
					},
					write(response) {
						expect(response.message).to.be.instanceof(Response);
						expect(response.message.toString()).to.equal('Subscribed');
						expect(response.message.status).to.equal(201);
						expect(response.topic).to.equal('/foo');
						expect(response.type).to.equal('subscribe');
					}
				}
			}, () => Promise.resolve());

			expect(sd.topics['/foo'].subs.size).to.equal(1);
			unsub.end();

			expect(sd.topics['/foo']).to.be.undefined;
		});

		it('should unsubscribe if stream errors', async () => {
			const sd = new ServiceDispatcher('/foo', {
				onSubscribe() {
					// noop
				},
				onUnsubscribe() {
					// noop
				}
			});

			let unsub = {};

			sd.handler({
				path: '/foo',
				realPath: '/foo',
				request: {
					type: 'subscribe'
				},
				response: {
					once(evt, fn) {
						unsub[evt] = fn;
					},
					write(response) {
						expect(response.message).to.be.instanceof(Response);
						expect(response.message.toString()).to.equal('Subscribed');
						expect(response.message.status).to.equal(201);
						expect(response.topic).to.equal('/foo');
						expect(response.type).to.equal('subscribe');
					}
				}
			}, () => Promise.resolve());

			expect(sd.topics['/foo'].subs.size).to.equal(1);
			unsub.error();

			expect(sd.topics).to.not.have.property('/foo');
		});
	});
});
