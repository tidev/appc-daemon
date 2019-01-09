import { DataServiceDispatcher, DispatcherError } from '../dist/index';

describe('DataServiceDispatcher', () => {
	describe('topic', () => {
		it('should get the topic when no filter is specified', () => {
			const svc = new DataServiceDispatcher();
			const ctx = { request: { params: {} } };
			const topic = svc.getTopic(ctx);
			expect(topic).to.equal('');
		});

		it('should get the topic when filter is specified', () => {
			const svc = new DataServiceDispatcher();
			const ctx = { request: { params: { filter: 'foo/bar.baz' } } };
			const topic = svc.getTopic(ctx);
			expect(topic).to.equal('foo.bar.baz');
		});

		it('should get the topic when topic is specified', () => {
			const svc = new DataServiceDispatcher();
			const ctx = { request: { params: { filter: 'foo' }, topic: 'bar' } };
			const topic = svc.getTopic(ctx);
			expect(topic).to.equal('bar');
		});
	});

	describe('call', () => {
		it('should returns unfiltered data', () => {
			const svc = new DataServiceDispatcher();
			svc.data.foo = 'bar';
			const ctx = { request: { params: {} } };
			svc.onCall(ctx);
			expect(ctx.response).to.deep.equal({ foo: 'bar' });
		});

		it('should returns filtered data', () => {
			const svc = new DataServiceDispatcher();
			svc.data.foo = 'bar';
			const ctx = { request: { params: { filter: '/foo' } } };
			svc.onCall(ctx);
			expect(ctx.response).to.equal('bar');
		});

		it('should throw 404 if data does not exist', () => {
			expect(() => {
				const svc = new DataServiceDispatcher();
				const ctx = { request: { params: { filter: '/foo' } } };
				svc.onCall(ctx);
			}).to.throw(DispatcherError);
		});
	});

	describe('subscribe', () => {
		it('should subscribe without filter', () => {
			class Test extends DataServiceDispatcher {
				//
			}

			const svc = new Test();
			svc.data.foo = 'bar';

			let sid = null;
			let subscribeCount = 0;
			let eventCount = 0;
			let unsubscribeCount = 0;

			const ctx = {
				path: '/',
				request: {
					params: {},
					type: 'subscribe'
				},
				response: {
					end() {
						// noop
					},
					once() {
						// noop
					},
					write(data) {
						switch (data.type) {
							case 'subscribe':
								subscribeCount++;
								sid = data.sid;
								break;
							case 'event':
								switch (++eventCount) {
									case 1:
										expect(data.message).to.deep.equal({ foo: 'bar' });
										break;

									case 2:
										expect(data.message).to.deep.equal({ foo: 'baz' });
										break;
								}
								break;
							case 'unsubscribe':
								unsubscribeCount++;
								break;
						}
					}
				}
			};

			svc.handler(ctx);
			expect(subscribeCount).to.equal(1);
			expect(eventCount).to.equal(1);
			expect(unsubscribeCount).to.equal(0);

			svc.data.foo = 'baz';
			expect(subscribeCount).to.equal(1);
			expect(eventCount).to.equal(2);
			expect(unsubscribeCount).to.equal(0);

			const ctx2 = {
				path: '/',
				request: {
					params: {},
					sid,
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

			svc.handler(ctx2);
			expect(subscribeCount).to.equal(1);
			expect(eventCount).to.equal(2);
			expect(unsubscribeCount).to.equal(1);

			svc.data.foo = 'pow';
			expect(subscribeCount).to.equal(1);
			expect(eventCount).to.equal(2);
			expect(unsubscribeCount).to.equal(1);
		});
	});

	it('should subscribe with filter', () => {
		class Test extends DataServiceDispatcher {
			//
		}

		const svc = new Test();
		svc.data.foo = 'bar';

		let sid = null;
		let subscribeCount = 0;
		let eventCount = 0;
		let unsubscribeCount = 0;

		const ctx = {
			path: '/',
			request: {
				params: {
					filter: '/foo'
				},
				type: 'subscribe'
			},
			response: {
				end() {
					// noop
				},
				once() {
					// noop
				},
				write(data) {
					switch (data.type) {
						case 'subscribe':
							subscribeCount++;
							sid = data.sid;
							break;
						case 'event':
							switch (++eventCount) {
								case 1:
									expect(data.message).to.equal('bar');
									break;

								case 2:
									expect(data.message).to.equal('baz');
									break;
							}
							break;
						case 'unsubscribe':
							unsubscribeCount++;
							break;
					}
				}
			}
		};

		svc.handler(ctx);
		expect(subscribeCount).to.equal(1);
		expect(eventCount).to.equal(1);
		expect(unsubscribeCount).to.equal(0);

		svc.data.foo = 'baz';
		expect(subscribeCount).to.equal(1);
		expect(eventCount).to.equal(2);
		expect(unsubscribeCount).to.equal(0);

		const ctx2 = {
			path: '/',
			request: {
				params: {},
				sid,
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

		svc.handler(ctx2);
		expect(subscribeCount).to.equal(1);
		expect(eventCount).to.equal(2);
		expect(unsubscribeCount).to.equal(1);

		svc.data.foo = 'pow';
		expect(subscribeCount).to.equal(1);
		expect(eventCount).to.equal(2);
		expect(unsubscribeCount).to.equal(1);
	});
});
