import Client from '../dist/client';
import msgpack from 'msgpack-lite';

import { Server as WebSocketServer } from 'ws';

describe('Client', () => {

	describe('constructor', () => {
		it('should create a client instance', () => {
			const client = new Client();
			expect(client).to.be.instanceof(Client);
		});

		it('should fail if port is invalid', () => {
			expect(() => {
				new Client({ port: 'foo' });
			}).to.throw(TypeError, 'Invalid port, expected a number between 1 and 65535');

			expect(() => {
				new Client({ port: 123456 });
			}).to.throw(TypeError, 'Invalid port, expected a number between 1 and 65535');

			expect(() => {
				new Client({ port: -1 });
			}).to.throw(TypeError, 'Invalid port, expected a number between 1 and 65535');

			expect(() => {
				new Client({ port: null });
			}).to.not.throw();
		});
	});

	describe('User Agent', () => {
		it('should autogenerate a user agent', () => {
			const client = new Client();
			expect(client.userAgent).to.be.a('string');
			expect(client.userAgent).to.not.equal('');

			const parts = client.userAgent.split(' ');
			expect(parts[0]).to.match(/^.+(\/(\d+\.\d+\.\d+)?)?$/);
			expect(parts[1]).to.match(/^appcd-client\/\d+\.\d+\.\d+/);
			expect(parts[2]).to.equal('node/' + process.version.replace(/^v/, ''));
			expect(parts[3]).to.equal(process.platform);
			expect(parts[4]).to.equal(process.arch);
		});

		it('should error if user agent is not a string', () => {
			expect(() => {
				new Client({ userAgent: 123 });
			}).to.throw(TypeError, 'Expected user agent to be a string');
		});

		it('should use custom user agent', () => {
			const client = new Client({ userAgent: 'foo/1.0.0 bar/1.0.0' });
			const parts = client.userAgent.split(' ');
			expect(parts[0]).to.equal('foo/1.0.0');
			expect(parts[1]).to.equal('bar/1.0.0');
			expect(parts[2]).to.match(/^appcd-client\/\d+\.\d+\.\d+/);
			expect(parts[3]).to.equal('node/' + process.version.replace(/^v/, ''));
			expect(parts[4]).to.equal(process.platform);
			expect(parts[5]).to.equal(process.arch);
		});
	});

	describe('connect()', () => {
		it('should fail to connect', done => {
			const client = new Client({ port: 12345 });
			client.connect()
				.on('connected', () => {
					client.disconnect();
					done(new Error('Expected client to fail to connect'));
				})
				.on('error', err => {
					expect(err).to.be.instanceof(Error);
					expect(err.code).to.equal('ECONNREFUSED');
					done();
				});
		});

		it('should connect to the mock server', done => {
			let result = null;
			let count = 0;
			function finish() {
				if (++count === 2) {
					done(result);
				}
			}

			const server = new WebSocketServer({ port: 12345 });
			server.on('connection', () => {
				server.close(() => finish());
			});

			const client = new Client({ port: 12345 });
			let connected = false;

			client.connect()
				.on('connected', () => {
					connected = true;
				})
				.on('close', () => {
					try {
						expect(connected).to.be.true;
					} catch (e) {
						result = result || e;
					}
					finish();
				})
				.on('error', err => {
					result = result || err;
					finish();
				});
		});

		it('should emit connected event if already connected', done => {
			const server = new WebSocketServer({ port: 12345 });
			const client = new Client({ port: 12345 });

			client.connect()
				.on('connected', () => {
					client.connect()
						.on('connected', () => {
							server.close(() => done());
						})
						.on('error', done);
				})
				.on('error', done);
		});
	});

	describe('request()', () => {
		it('should make a request to the mock server', done => {
			let result = null;
			let count = 0;
			const server = new WebSocketServer({ port: 12345 });

			function finish() {
				if (++count === 1) {
					server.close(() => {
						done(result);
					});
				}
			}

			server.on('connection', (conn, req) => {
				conn.on('message', msg => {
					let json;
					try {
						json = JSON.parse(msg);
					} catch (e) {
						result = result || e;
						return;
					}

					try {
						expect(req.headers).to.have.property('user-agent');
						expect(req.headers['user-agent']).to.match(/ appcd-client\//);
						if (req.headers['accept-language']) {
							expect(req.headers['accept-language']).to.match(/^([a-z]{2})(?:[-_](?:\w+[-_])?([A-Z]{2}))?$/i);
						}
						expect(json).to.be.an('object');
						expect(json).to.have.keys('version', 'path', 'id', 'data');
						expect(json.version).to.be.a('string');
						expect(json.version).to.equal('1.0');
						expect(json.path).to.be.a('string');
						expect(json.path).to.equal('/foo');
						expect(json.id).to.be.a('string');
						expect(json.id).to.not.equal('');
						expect(json.data).to.be.an('object');
						expect(json.data.foo).to.equal('bar');
					} catch (e) {
						result = result || e;
					}

					conn.send(JSON.stringify({
						status: 200,
						id: json.id,
						message: { baz: 'wiz' }
					}));
				});
			});

			const client = new Client({ port: 12345 });

			client.request({ path: '/foo', data: { foo: 'bar' } })
				.on('response', (data, response) => {
					try {
						expect(data).to.be.an('object');
						expect(data).to.deep.equal({ baz: 'wiz' });

						expect(response).to.be.an('object');
						expect(response).to.have.keys('id', 'status', 'message');
						expect(response.status).to.equal(200);
						expect(response.message).to.deep.equal({ baz: 'wiz' });
					} catch (e) {
						result = result || e;
					}
					client.disconnect();
					finish();
				})
				.on('close', () => {
					result = result || new Error('Expected response, not close');
					finish();
				})
				.on('error', err => {
					result = result || err;
					finish();
				});
		});

		it('should handle 4xx request errors', done => {
			const server = new WebSocketServer({ port: 12345 });

			server.on('connection', conn => {
				conn.on('message', msg => {
					conn.send(JSON.stringify({
						status: 404,
						statusCode: '404',
						id: JSON.parse(msg).id,
						message: 'Not found',
						type: 'error'
					}));
				});
			});

			const client = new Client({ port: 12345 });

			client.request('/foo', { foo: 'bar' })
				.on('response', () => {
					server.close(() => done(new Error('Expected error to be caught')));
				})
				.on('close', () => {
					server.close(() => done(new Error('Expected response, not close')));
				})
				.on('error', err => {
					try {
						expect(err.message).to.equal('Not found');
						expect(err.errorCode).to.equal(404);
						expect(err.code).to.equal('404');
						server.close(() => done());
					} catch (e) {
						server.close(() => done(e));
					}
				});
		});

		it('should handle 5xx request errors', done => {
			const server = new WebSocketServer({ port: 12345 });

			server.on('connection', conn => {
				conn.on('message', msg => {
					conn.send(JSON.stringify({
						status: 500,
						statusCode: '500.1',
						id: JSON.parse(msg).id,
						message: 'Server error',
						type: 'error'
					}));
				});
			});

			const client = new Client({ port: 12345 });

			client.request('/foo', { foo: 'bar' })
				.on('response', () => {
					server.close(() => done(new Error('Expected error to be caught')));
				})
				.on('close', () => {
					server.close(() => done(new Error('Expected response, not close')));
				})
				.on('error', err => {
					try {
						expect(err.message).to.equal('Server error');
						expect(err.errorCode).to.equal(500);
						expect(err.code).to.equal('500.1');
						server.close(() => done());
					} catch (e) {
						server.close(() => done(e));
					}
				});
		});

		it('should handle empty 5xx request errors', done => {
			const server = new WebSocketServer({ port: 12345 });

			server.on('connection', conn => {
				conn.on('message', msg => {
					conn.send(JSON.stringify({
						status: 500,
						id: JSON.parse(msg).id,
						type: 'error'
					}));
				});
			});

			const client = new Client({ port: 12345 });

			client.request('/foo', { foo: 'bar' })
				.on('response', () => {
					server.close(() => done(new Error('Expected error to be caught')));
				})
				.on('close', () => {
					server.close(() => done(new Error('Expected response, not close')));
				})
				.on('error', err => {
					try {
						expect(err.message).to.equal('Server Error');
						expect(err.errorCode).to.equal(500);
						expect(err.code).to.equal('500');
						server.close(() => done());
					} catch (e) {
						server.close(() => done(e));
					}
				});
		});

		it('should treat unknown server errors as 500 errors', done => {
			const server = new WebSocketServer({ port: 12345 });

			server.on('connection', conn => {
				conn.on('message', msg => {
					conn.send(JSON.stringify({
						id: JSON.parse(msg).id,
						type: 'error'
					}));
				});
			});

			const client = new Client({ port: 12345 });

			client.request('/foo', { foo: 'bar' })
				.on('response', () => {
					server.close(() => done(new Error('Expected error to be caught')));
				})
				.on('close', () => {
					server.close(() => done(new Error('Expected response, not close')));
				})
				.on('error', err => {
					try {
						expect(err.message).to.equal('Server Error');
						expect(err.errorCode).to.equal(500);
						expect(err.code).to.equal('500');
						server.close(() => done());
					} catch (e) {
						server.close(() => done(e));
					}
				});
		});

		it('should handle binary responses', done => {
			const server = new WebSocketServer({ port: 12345 });

			server.on('connection', conn => {
				conn.on('message', msg => {
					conn.send(msgpack.encode({
						status: 200,
						id: JSON.parse(msg).id,
						message: { baz: 'wiz' }
					}));
				});
			});

			const client = new Client({ port: 12345 });

			client.request('/foo')
				.on('response', (data, response) => {
					server.close(() => {
						try {
							expect(data).to.be.an('object');
							expect(data).to.deep.equal({ baz: 'wiz' });

							expect(response).to.be.an('object');
							expect(response).to.have.keys('id', 'status', 'message');
							expect(response.status).to.equal(200);
							expect(response.message).to.deep.equal({ baz: 'wiz' });
							done();
						} catch (e) {
							done(e);
						}
					});
				})
				.on('close', () => {
					server.close(() => done(new Error('Expected response, not close')));
				})
				.on('warning', () => {
					server.close(() => done(new Error('Expected response, not warning')));
				})
				.on('error', err => {
					server.close(() => done(err));
				});
		});

		it('should ignore server responses that are invalid', done => {
			const server = new WebSocketServer({ port: 12345 });

			server.on('connection', conn => {
				conn.on('message', () => {
					conn.send('foo');
				});
			});

			const client = new Client({ port: 12345 });

			client.request('/foo')
				.on('warning', msg => {
					server.close(() => {
						try {
							expect(msg).to.match(/^Server returned invalid JSON:/);
							done();
						} catch (e) {
							done(e);
						}
					});
				})
				.on('response', () => {
					server.close(() => done(new Error('Expected warning, not response')));
				})
				.on('close', () => {
					server.close(() => done(new Error('Expected warning, not close')));
				})
				.on('error', err => {
					server.close(() => done(err));
				});
		});

		it('should ignore server responses that has invalid id', done => {
			const server = new WebSocketServer({ port: 12345 });

			server.on('connection', conn => {
				conn.on('message', () => {
					conn.send('{}');
				});
			});

			const client = new Client({ port: 12345 });

			client.request('/foo')
				.on('warning', msg => {
					server.close(() => {
						try {
							expect(msg).to.equal('Server response is not an object or has an invalid id');
							done();
						} catch (e) {
							done(e);
						}
					});
				})
				.on('response', () => {
					server.close(() => done(new Error('Expected warning, not response')));
				})
				.on('close', () => {
					server.close(() => done(new Error('Expected warning, not close')));
				})
				.on('error', err => {
					server.close(() => done(err));
				});
		});

		it('should error if server is not running', done => {
			const client = new Client({ port: 12345 });

			client.request('/foo')
				.on('warning', () => {
					done(new Error('Expected error, not warning'));
				})
				.on('response', () => {
					done(new Error('Expected error, not response'));
				})
				.on('close', () => {
					done(new Error('Expected error, not close'));
				})
				.on('error', () => {
					done();
				});
		});
	});

});
