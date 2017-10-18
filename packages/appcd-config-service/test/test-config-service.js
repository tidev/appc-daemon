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

	it('should implicitly get a config', () => {
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
				}
			},
			params: {
				key: null
			},
			response: null
		};

		cs.onCall(ctx);

		expect(ctx.response).to.deep.equal(json);
	});

	it('should explicitly get a config', () => {
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
				}
			},
			params: {
				key: null
			},
			response: null
		};

		cs.onCall(ctx);

		expect(ctx.response).to.deep.equal(json);
	});

	it('should get a nested config value using dots', () => {
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
				}
			},
			params: {
				key: null
			},
			response: null
		};

		cs.onCall(ctx);

		expect(ctx.response).to.equal('baz');
	});

	it('should get a nested config value using slashes', () => {
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
				}
			},
			params: {
				key: null
			},
			response: null
		};

		cs.onCall(ctx);

		expect(ctx.response).to.equal('baz');
	});

	it('should error if key is not valid', () => {
		const cs = createConfigService({
			foo: 'bar'
		});

		const ctx = {
			request: {
				data: {
					action: 'get',
					key: 123,
					value: null
				}
			},
			params: {
				key: null
			},
			response: null
		};

		expect(() => {
			cs.onCall(ctx);
		}).to.throw(DispatcherError, 'Missing or empty key');
	});

	it('should error if action is not valid', () => {
		const cs = createConfigService({
			foo: 'bar'
		});

		const ctx = {
			request: {
				data: {
					action: 'foo',
					key: null,
					value: null
				}
			},
			params: {
				key: null
			},
			response: null
		};

		expect(() => {
			cs.onCall(ctx);
		}).to.throw(DispatcherError, 'Invalid action: foo');
	});

	it('should error if key not found', () => {
		const cs = createConfigService({});

		const ctx = {
			request: {
				data: {
					action: null,
					key: null,
					value: null
				}
			},
			params: {
				key: 'foo'
			},
			response: null
		};

		expect(() => {
			cs.onCall(ctx);
		}).to.throw(DispatcherError, 'Not Found: foo');
	});

	it('should error when setting a config value without a key', () => {
		const cs = createConfigService({});

		const ctx = {
			request: {
				data: {
					action: 'set',
					key: null,
					value: 'bar'
				}
			},
			params: {
				key: null
			},
			response: null
		};

		expect(() => {
			cs.onCall(ctx);
		}).to.throw(DispatcherError, 'Not allowed to set config root');
	});

	it('should set a config value', () => {
		const cs = createConfigService({});

		let ctx = {
			request: {
				data: {
					action: 'set',
					key: 'foo',
					value: 'bar'
				}
			},
			params: {
				key: null
			},
			response: null
		};

		cs.onCall(ctx);

		expect(ctx.response).to.be.instanceof(Response);
		expect(ctx.response.statusCode).to.equal(200);

		ctx = {
			request: {
				data: {
					action: 'get',
					key: 'foo',
					value: null
				}
			},
			params: {
				key: null
			},
			response: null
		};

		cs.onCall(ctx);

		expect(ctx.response).to.equal('bar');
	});

	it('should error deleting a config value without a key', () => {
		const cs = createConfigService({
			foo: 'bar'
		});

		let ctx = {
			request: {
				data: {
					action: 'delete',
					key: null,
					value: null
				}
			},
			params: {
				key: null
			},
			response: null
		};

		expect(() => {
			cs.onCall(ctx);
		}).to.throw(DispatcherError, 'Not allowed to delete config root');
	});

	it('should error deleting a config value that does not exist', () => {
		const cs = createConfigService({
			foo: 'bar'
		});

		const ctx = {
			request: {
				data: {
					action: 'delete',
					key: 'baz',
					value: null
				}
			},
			params: {
				key: null
			},
			response: null
		};

		cs.onCall(ctx);

		expect(ctx.response).to.be.instanceof(Response);
		expect(ctx.response.statusCode).to.equal(404);
	});

	it('should deleting a config value', () => {
		const cs = createConfigService({
			foo: 'bar'
		});

		let ctx = {
			request: {
				data: {
					action: 'delete',
					key: 'foo',
					value: null
				}
			},
			params: {
				key: null
			},
			response: null
		};

		cs.onCall(ctx);

		expect(ctx.response).to.be.instanceof(Response);
		expect(ctx.response.statusCode).to.equal(200);

		ctx = {
			request: {
				data: {
					action: 'get',
					key: null,
					value: null
				}
			},
			params: {
				key: null
			},
			response: null
		};

		cs.onCall(ctx);

		expect(ctx.response).to.deep.equal({});
	});

	it('should subscribe and unsubscribe to config changes', () => {
		const cs = createConfigService({});

		const ctx = {
			params: {
				key: null
			}
		};

		let i = 0;

		const publish = value => {
			switch (++i) {
				case 1:
					expect(value).to.deep.equal({});
					break;

				case 2:
					expect(value).to.deep.equal({ foo: 'bar' });
					break;

				case 3:
					expect(value).to.deep.equal({});
					break;

				case 4:
					throw new Error('Expected publish to be unsubscribed');
			}
		};

		cs.onSubscribe(ctx, publish);
		cs.config.set('foo', 'bar');
		cs.config.delete('foo');
		cs.onUnsubscribe(ctx, publish);
		cs.config.set('foo', 'bar');
	});
});

function createConfigService(json) {
	const cfg = new Config({ config: json });
	return new ConfigService(cfg);
}
