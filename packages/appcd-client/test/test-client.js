import Client from '../src/index';
import { Server as WebSocketServer } from 'ws';

describe('Client', () => {

	it('should create a client instance', () => {
		const client = new Client;
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

	it('should autogenerate a user agent', () => {
		const client = new Client;
		expect(client.userAgent).to.be.a.String;
		expect(client.userAgent).to.not.equal('');

		const parts = client.userAgent.split(' ');
		expect(parts[0]).to.match(/^.+(\/(\d\.\d\.\d)?)?$/);
		expect(parts[1]).to.equal('node/' + process.version.replace(/^v/, ''));
		expect(parts[2]).to.equal(process.platform);
		expect(parts[3]).to.equal(process.arch);
	});

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
		server.on('connection', conn => {
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

		server.on('connection', conn => {
			conn.on('message', msg => {
				let json;
				try {
					json = JSON.parse(msg);
				} catch (e) {
					result = result || e;
					return;
				}

				try {
					expect(json).to.be.an.Object;
					expect(json).to.have.keys('version', 'path', 'id', 'userAgent', 'data');
					expect(json.version).to.be.a.String;
					expect(json.version).to.equal('1.0');
					expect(json.path).to.be.a.String;
					expect(json.path).to.equal('/foo');
					expect(json.id).to.be.a.String;
					expect(json.id).to.not.equal('');
					expect(json.userAgent).to.be.a.String;
					expect(json.userAgent).to.not.equal('');
					expect(json.data).to.be.an.Object;
					expect(json.data.foo).to.equal('bar');
				} catch (e) {
					result = result || e;
				}

				conn.send(JSON.stringify({
					status: 200,
					id: json.id,
					data: { baz: 'wiz' }
				}));
			});
		});

		const client = new Client({ port: 12345 });

		client.request('/foo', { foo: 'bar' })
			.on('response', (data, response) => {
				try {
					expect(data).to.be.an.Object;
					expect(data).to.deep.equal({ baz: 'wiz' });

					expect(response).to.be.an.Object;
					expect(response).to.have.keys('id', 'status', 'data');
					expect(response.status).to.equal(200);
					expect(response.data).to.deep.equal({ baz: 'wiz' });
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

});
