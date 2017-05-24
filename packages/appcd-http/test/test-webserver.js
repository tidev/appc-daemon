import path from 'path';
import request from 'supertest';
import WebServer from '../dist/index';
import WebSocket from 'ws';

describe('webserver', () => {
	it('should error if options is not an object', () => {
		expect(() => {
			new WebServer(123);
		}).to.throw(TypeError, 'Expected options to be an object');

		expect(() => {
			new WebServer(null);
		}).to.throw(TypeError, 'Expected options to be an object');
	});

	it('should error if hostname is not a string', () => {
		expect(() => {
			new WebServer({
				hostname: 123
			});
		}).to.throw(TypeError, 'Expected hostname to be a string');

		expect(() => {
			new WebServer({
				hostname: function () {}
			});
		}).to.throw(TypeError, 'Expected hostname to be a string');
	});

	it('should error if port is invalid', () => {
		expect(() => {
			new WebServer();
		}).to.throw(TypeError, 'Expected port to be positive integer between 1 and 65535');

		expect(() => {
			new WebServer({
				port: 'foo'
			});
		}).to.throw(TypeError, 'Expected port to be positive integer between 1 and 65535');

		expect(() => {
			new WebServer({
				port: NaN
			});
		}).to.throw(TypeError, 'Expected port to be positive integer between 1 and 65535');

		expect(() => {
			new WebServer({
				port: -123
			});
		}).to.throw(RangeError, 'Expected port to be positive integer between 1 and 65535');

		expect(() => {
			new WebServer({
				port: 123456
			});
		}).to.throw(RangeError, 'Expected port to be positive integer between 1 and 65535');
	});

	it('should error webroot is invalid', () => {
		expect(() => {
			new WebServer({
				port: 1337,
				webroot: 123
			});
		}).to.throw(TypeError, 'Expected web root directory to be a string');

		expect(() => {
			new WebServer({
				port: 1337,
				webroot: function () {}
			});
		}).to.throw(TypeError, 'Expected web root directory to be a string');

		const dir = path.join(__dirname, 'doesnotexist');
		expect(() => {
			new WebServer({
				port: 1337,
				webroot: dir
			});
		}).to.throw(Error, `Web root directory does not exist or is not a directory: ${dir}`);

		expect(() => {
			new WebServer({
				port: 1337,
				webroot: __filename
			});
		}).to.throw(Error, `Web root directory does not exist or is not a directory: ${__filename}`);
	});

	it('should error if index is not a string', () => {
		expect(() => {
			new WebServer({
				port: 1337,
				index: 123
			});
		}).to.throw(TypeError, 'Expected index to be a string');

		expect(() => {
			new WebServer({
				port: 1337,
				index: function () {}
			});
		}).to.throw(TypeError, 'Expected index to be a string');
	});

	it('should create a server, listen, and get static html file', done => {
		const server = new WebServer({
			port: 1337,
			hostname: '127.0.0.1'
		});

		server
			.listen()
			.then(() => {
				return request('http://127.0.0.1:1337')
					.get('/')
					.expect('Content-Type', /html/)
					.expect(200)
					.then(response => {
						expect(response.text).to.match(/<h1>appcd-http<\/h1>/);
					});
			})
			.then(() => {
				server
					.close()
					.then(() => done())
					.catch(err2 => done());
			})
			.catch(err => {
				server
					.close()
					.then(() => done(err))
					.catch(err2 => done(err));
			});
	});

	it('should accept incoming WebSocket connection', done => {
		const server = new WebServer({
			port: 1337,
			hostname: '127.0.0.1'
		});

		server
			.on('websocket', conn => {
				conn.on('message', msg => {
					try {
						conn.send(JSON.parse(msg).foo.split('').reverse().join(''));
					} catch (e) {}
					conn.close();
				});
			})
			.listen()
			.then(() => new Promise((resolve, reject) => {
				const ws = new WebSocket('ws://127.0.0.1:1337');
				ws.on('open', () => ws.send(JSON.stringify({ foo: 'hello' })));
				ws.on('message', data => {
					try {
						expect(data).to.equal('olleh');
					} catch (e) {
						ws.close();
						reject(e);
					}
				});
				ws.on('error', reject);
				ws.on('close', () => resolve());
			}))
			.then(() => {
				server
					.close()
					.then(() => done())
					.catch(err2 => done());
			})
			.catch(err => {
				server
					.close()
					.then(() => done(err))
					.catch(err2 => done(err));
			});
	});

	it('should execute middleware', done => {
		const server = new WebServer({
			port: 1337,
			hostname: '127.0.0.1'
		});

		server
			.use((ctx, next) => {
				ctx.body = 'hello!';
			})
			.listen()
			.then(() => {
				return request('http://127.0.0.1:1337')
					.get('/')
					.expect('Content-Type', /text/)
					.expect(200)
					.then(response => {
						expect(response.text).to.equal('hello!');
					});
			})
			.then(() => {
				server
					.close()
					.then(() => done())
					.catch(err2 => done());
			})
			.catch(err => {
				server
					.close()
					.then(() => done(err))
					.catch(err2 => done(err));
			});
	});

	it('should handle 400 errors', done => {
		const server = new WebServer({
			port: 1337,
			hostname: '127.0.0.1'
		});

		server
			.use((ctx, next) => {
				const err = new Error('go away!');
				err.expose = true;
				err.status = 403;
				throw err;
			})
			.listen()
			.then(() => {
				return request('http://127.0.0.1:1337')
					.get('/')
					.expect('Content-Type', /text/)
					.expect(403)
					.then(response => {
						expect(response.text).to.equal('go away!');
					});
			})
			.then(() => {
				server
					.close()
					.then(() => done())
					.catch(err2 => done());
			})
			.catch(err => {
				server
					.close()
					.then(() => done(err))
					.catch(err2 => done(err));
			});
	});

	it('should handle 500 errors', done => {
		const server = new WebServer({
			port: 1337,
			hostname: '127.0.0.1'
		});

		server
			.use((ctx, next) => {
				const err = new Error('oh no!');
				err.expose = true;
				throw err;
			})
			.listen()
			.then(() => {
				return request('http://127.0.0.1:1337')
					.get('/')
					.expect('Content-Type', /text/)
					.expect(500)
					.then(response => {
						expect(response.text).to.equal('oh no!');
					});
			})
			.then(() => {
				server
					.close()
					.then(() => done())
					.catch(err2 => done());
			})
			.catch(err => {
				server
					.close()
					.then(() => done(err))
					.catch(err2 => done(err));
			});
	});
});
