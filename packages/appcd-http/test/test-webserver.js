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

	it('should create a server, listen, and get static html file', async () => {
		const server = new WebServer({
			port: 1337,
			hostname: '127.0.0.1'
		});

		try {
			await server.listen();

			const response = await request('http://127.0.0.1:1337')
				.get('/')
				.expect('Content-Type', /html/)
				.expect(200);

			expect(response.text).to.match(/<h1>appcd-http<\/h1>/);
		} finally {
			await server.shutdown();
		}
	});

	it('should accept incoming WebSocket connection', async () => {
		const server = new WebServer({
			port: 1337,
			hostname: '127.0.0.1'
		});

		try {
			server.on('websocket', conn => {
				conn.on('message', msg => {
					try {
						conn.send(JSON.parse(msg).foo.split('').reverse().join(''));
					} catch (e) {
						// squeltch
					}
					conn.close();
				});
			});

			await server.listen();

			await new Promise((resolve, reject) => {
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
			});
		} finally {
			await server.shutdown();
		}
	});

	it('should execute middleware', async () => {
		const server = new WebServer({
			port: 1337,
			hostname: '127.0.0.1'
		});

		try {
			server.use(ctx => {
				ctx.body = 'hello!';
			});

			await server.listen();

			const response = await request('http://127.0.0.1:1337')
				.get('/')
				.expect('Content-Type', /text/)
				.expect(200);
			expect(response.text).to.equal('hello!');
		} finally {
			await server.shutdown();
		}
	});

	it('should handle 400 errors', async () => {
		const server = new WebServer({
			port: 1337,
			hostname: '127.0.0.1'
		});

		try {
			server.use(() => {
				const err = new Error('go away!');
				err.expose = true;
				err.status = 403;
				throw err;
			});

			await server.listen();

			const response = await request('http://127.0.0.1:1337')
				.get('/')
				.expect('Content-Type', /text/)
				.expect(403);
			expect(response.text).to.equal('go away!');
		} finally {
			await server.shutdown();
		}
	});

	it('should handle 500 errors', async () => {
		const server = new WebServer({
			port: 1337,
			hostname: '127.0.0.1'
		});

		try {
			server.use(() => {
				const err = new Error('oh no!');
				err.expose = true;
				throw err;
			});

			await server.listen();

			const response = await request('http://127.0.0.1:1337')
				.get('/')
				.expect('Content-Type', /text/)
				.expect(500);
			expect(response.text).to.equal('oh no!');
		} finally {
			await server.shutdown();
		}
	});
});
