import Config from 'appcd-config';
import ConfigService from '../dist/config-service';
import Response from 'appcd-response';

import { DispatcherError } from 'appcd-dispatcher';

describe('Config Service', () => {
	it('should error if config is invalid', () => {
		expect(() => {
			new ConfigService();
		}).to.throw(TypeError, 'Expected config to be a valid config object');

		expect(() => {
			new ConfigService(null);
		}).to.throw(TypeError, 'Expected config to be a valid config object');

		expect(() => {
			new ConfigService('foo');
		}).to.throw(TypeError, 'Expected config to be a valid config object');
	});

	it('should implicitly get a config', async () => {
		const json = {
			foo: 'bar'
		};

		const cs = createConfigService(json);

		const ctx = {
			request: {
				data: {
					action: null,
					key: null,
					value: null
				},
				params: {
					filter: null
				}
			},
			response: null
		};

		await cs.onCall(ctx);

		expect(ctx.response).to.deep.equal(json);
	});

	it('should explicitly get a config', async () => {
		const json = {
			foo: 'bar'
		};

		const cs = createConfigService(json);

		const ctx = {
			request: {
				data: {
					action: 'get',
					key: null,
					value: null
				},
				params: {
					filter: null
				}
			},
			response: null
		};

		await cs.onCall(ctx);

		expect(ctx.response).to.deep.equal(json);
	});

	it('should get a nested config value using dots', async () => {
		const cs = createConfigService({
			foo: {
				bar: 'baz'
			}
		});

		const ctx = {
			request: {
				data: {
					action: 'get',
					key: 'foo.bar',
					value: null
				},
				params: {
					filter: null
				}
			},
			response: null
		};

		await cs.onCall(ctx);

		expect(ctx.response).to.equal('baz');
	});

	it('should get a nested config value using slashes', async () => {
		const cs = createConfigService({
			foo: {
				bar: 'baz'
			}
		});

		const ctx = {
			request: {
				data: {
					action: 'get',
					key: '/foo/bar',
					value: null
				},
				params: {
					filter: null
				}
			},
			response: null
		};

		await cs.onCall(ctx);

		expect(ctx.response).to.equal('baz');
	});

	it('should error if key is not valid', async () => {
		const cs = createConfigService({
			foo: 'bar'
		});

		const ctx = {
			request: {
				data: {
					action: 'get',
					key: 123,
					value: null
				},
				params: {
					filter: null
				}
			},
			response: null
		};

		try {
			await cs.onCall(ctx);
		} catch (e) {
			expect(e).to.be.instanceof(DispatcherError);
			expect(e.message).to.equal('Missing or empty key');
			return;
		}

		throw new Error('Expected error to throw');
	});

	it('should error if action is not valid', async () => {
		const cs = createConfigService({
			foo: 'bar'
		});

		const ctx = {
			request: {
				data: {
					action: 'foo',
					key: null,
					value: null
				},
				params: {
					filter: null
				}
			},
			response: null
		};

		try {
			await cs.onCall(ctx);
		} catch (e) {
			expect(e).to.be.instanceof(DispatcherError);
			expect(e.message).to.equal('Invalid action: foo');
			return;
		}

		throw new Error('Expected error to throw');
	});

	it('should error if key not found', async () => {
		const cs = createConfigService({});

		const ctx = {
			request: {
				data: {
					action: null,
					key: null,
					value: null
				},
				params: {
					filter: 'foo'
				}
			},
			response: null
		};

		try {
			await cs.onCall(ctx);
		} catch (e) {
			expect(e).to.be.instanceof(DispatcherError);
			expect(e.message).to.equal('Not Found: foo');
			return;
		}

		throw new Error('Expected error to throw');
	});

	it('should error when setting a config value without a key', async () => {
		const cs = createConfigService({});

		const ctx = {
			request: {
				data: {
					action: 'set',
					key: null,
					value: 'bar'
				},
				params: {
					filter: null
				}
			},
			response: null
		};

		try {
			await cs.onCall(ctx);
		} catch (e) {
			expect(e).to.be.instanceof(DispatcherError);
			expect(e.message).to.equal('Not allowed to set config root');
			return;
		}

		throw new Error('Expected error to throw');
	});

	it('should set a config value', async () => {
		const cs = createConfigService({});

		let ctx = {
			request: {
				data: {
					action: 'set',
					key: 'foo',
					value: 'bar'
				},
				params: {
					filter: null
				}
			},
			response: null
		};

		await cs.onCall(ctx);

		expect(ctx.response).to.be.instanceof(Response);
		expect(ctx.response.statusCode).to.equal(200);

		ctx = {
			request: {
				data: {
					action: 'get',
					key: 'foo',
					value: null
				},
				params: {
					filter: null
				}
			},
			response: null
		};

		await cs.onCall(ctx);

		expect(ctx.response).to.equal('bar');
	});

	it('should error deleting a config value without a key', async () => {
		const cs = createConfigService({
			foo: 'bar'
		});

		let ctx = {
			request: {
				data: {
					action: 'delete',
					key: null,
					value: null
				},
				params: {
					filter: null
				}
			},
			response: null
		};

		try {
			await cs.onCall(ctx);
		} catch (e) {
			expect(e).to.be.instanceof(DispatcherError);
			expect(e.message).to.equal('Not allowed to delete config root');
			return;
		}

		throw new Error('Expected error to throw');
	});

	it('should error deleting a config value that does not exist', async () => {
		const cs = createConfigService({
			foo: 'bar'
		});

		const ctx = {
			request: {
				data: {
					action: 'delete',
					key: 'baz',
					value: null
				},
				params: {
					filter: null
				}
			},
			response: null
		};

		await cs.onCall(ctx);

		expect(ctx.response).to.be.instanceof(Response);
		expect(ctx.response.statusCode).to.equal(404);
	});

	it('should delete a config value', async () => {
		const cs = createConfigService({});

		let ctx = {
			request: {
				data: {
					action: 'set',
					key: 'foo',
					value: 'bar'
				},
				params: {
					filter: null
				}
			},
			response: null
		};

		await cs.onCall(ctx);

		ctx = {
			request: {
				data: {
					action: 'delete',
					key: 'foo',
					value: null
				},
				params: {
					filter: null
				}
			},
			response: null
		};

		await cs.onCall(ctx);

		expect(ctx.response).to.be.instanceof(Response);
		expect(ctx.response.statusCode).to.equal(200);

		ctx = {
			request: {
				data: {
					action: 'get',
					key: null,
					value: null
				},
				params: {
					filter: null
				}
			},
			response: null
		};

		await cs.onCall(ctx);

		expect(ctx.response).to.deep.equal({});
	});

	it('should support push', async () => {
		const cs = createConfigService({
			foo: 'bar'
		});

		let ctx = {
			request: {
				data: {
					action: 'push',
					key: 'foo',
					value: 'baz'
				},
				params: {
					filter: null
				}
			},
			response: null
		};

		await cs.onCall(ctx);

		expect(ctx.response).to.deep.equal([ 'bar', 'baz' ]);

		ctx = {
			request: {
				data: {
					action: 'get',
					key: null,
					value: null
				},
				params: {
					filter: null
				}
			},
			response: null
		};

		await cs.onCall(ctx);

		expect(ctx.response).to.deep.equal({ foo: [ 'bar', 'baz' ] });
	});

	it('should support unshift', async () => {
		const cs = createConfigService({
			foo: 'bar'
		});

		let ctx = {
			request: {
				data: {
					action: 'unshift',
					key: 'foo',
					value: 'baz'
				},
				params: {
					filter: null
				}
			},
			response: null
		};

		await cs.onCall(ctx);

		expect(ctx.response).to.deep.equal([ 'baz', 'bar' ]);

		ctx = {
			request: {
				data: {
					action: 'get',
					key: null,
					value: null
				},
				params: {
					filter: null
				}
			},
			response: null
		};

		await cs.onCall(ctx);

		expect(ctx.response).to.deep.equal({ foo: [ 'baz', 'bar' ] });
	});

	it('should support pop', async () => {
		const cs = createConfigService({
			foo: [ 'baz', 'bar' ]
		});

		let ctx = {
			request: {
				data: {
					action: 'pop',
					key: 'foo'
				},
				params: {
					filter: null
				}
			},
			response: null
		};

		await cs.onCall(ctx);

		expect(ctx.response).to.equal('bar');

		ctx = {
			request: {
				data: {
					action: 'get',
					key: null,
					value: null
				},
				params: {
					filter: null
				}
			},
			response: null
		};

		await cs.onCall(ctx);

		expect(ctx.response).to.deep.equal({ foo: [ 'baz' ] });
	});

	it('should support shift', async () => {
		const cs = createConfigService({
			foo: [ 'baz', 'bar' ]
		});

		let ctx = {
			request: {
				data: {
					action: 'shift',
					key: 'foo'
				},
				params: {
					filter: null
				}
			},
			response: null
		};

		await cs.onCall(ctx);

		expect(ctx.response).to.equal('baz');

		ctx = {
			request: {
				data: {
					action: 'get',
					key: null,
					value: null
				},
				params: {
					filter: null
				}
			},
			response: null
		};

		await cs.onCall(ctx);

		expect(ctx.response).to.deep.equal({ foo: [ 'bar' ] });
	});

	it('should subscribe and unsubscribe to config changes', async () => {
		const cs = createConfigService({});

		const ctx = {
			request: {
				params: {
					filter: null
				}
			}
		};

		let i = 0;

		const publish = value => {
			switch (++i) {
				case 1:
					expect(value).to.deep.equal({ foo: 'bar' });
					break;

				case 2:
					expect(value).to.deep.equal({});
					break;

				case 3:
					throw new Error('Expected publish to be unsubscribed');
			}
		};

		cs.initSubscription({ ctx, publish });
		cs.config.set('foo', 'bar');
		cs.config.delete('foo');
		cs.destroySubscription({ publish });
		cs.config.set('foo', 'bar');
	});
});

function createConfigService(json) {
	const cfg = new Config({ config: json });
	return new ConfigService(cfg);
}
