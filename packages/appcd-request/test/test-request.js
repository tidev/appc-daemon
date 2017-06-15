import Dispatcher from 'appcd-dispatcher';
import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import request from '../dist/request';

describe('request', () => {
	beforeEach(function () {
		Dispatcher.root.routes = [];
		this.server = null;
		this.server2 = null;
	});

	afterEach(function (done) {
		if (this.server) {
			this.server.close(() => {
				if (this.server2) {
					this.server2.close(() => done());
				} else {
					done();
				}
			});
		} else {
			done();
		}
	});

	it('should error if parameters is not an object', done => {
		request('foo')
			.then(() => {
				done(new Error('Expected error'));
			})
			.catch(err => {
				expect(err).to.be.an.instanceof(TypeError);
				expect(err.message).to.equal('Expected parameters to be an object');
				done();
			})
			.catch(done);
	});

	it('should error if callback is not a function', done => {
		request({}, 'foo')
			.then(() => {
				done(new Error('Expected error'));
			})
			.catch(err => {
				expect(err).to.be.an.instanceof(TypeError);
				expect(err.message).to.equal('Expected callback to be a function');
				done();
			})
			.catch(done);
	});

	it('should error if no URL using callback', function (done) {
		this.server = http.createServer((req, res) => {
			res.writeHead(200);
			res.end('foo!');
		});

		this.server.listen(1337, '127.0.0.1', () => {
			request({}, (err, res, body) => {
				try {
					if (err) {
						expect(err.message).to.equal('options.uri is a required argument');
						done();
					} else {
						done(new Error('Expected request to fail'));
					}
				} catch (e) {
					done(e);
				}
			});
		});
	});

	it('should make http request without default config', function (done) {
		this.server = http.createServer((req, res) => {
			res.end('foo!');
		});

		this.server.listen(1337, '127.0.0.1', () => {
			request({
				url: 'http://127.0.0.1:1337'
			}, (err, res, body) => {
				try {
					if (err) {
						throw err;
					}
					expect(res.statusCode).to.equal(200);
					expect(body).to.equal('foo!');
					done();
				} catch (e) {
					done(e);
				}
			});
		});
	});

	it('should make http request when getting config times out', function (done) {
		this.timeout(5000);
		this.slow(4000);

		Dispatcher.register('/appcd/config/network', ctx => {
			return new Promise((resolve, reject) => {
				setTimeout(() => {
					resolve();
				}, 2000);
			});
		});

		this.server = http.createServer((req, res) => {
			res.end('foo!');
		});

		this.server.listen(1337, '127.0.0.1', () => {
			request({
				url: 'http://127.0.0.1:1337'
			}, (err, res, body) => {
				try {
					if (err) {
						throw err;
					}
					expect(res.statusCode).to.equal(200);
					expect(body).to.equal('foo!');
					done();
				} catch (e) {
					done(e);
				}
			});
		});
	});

	it('should make http request when getting config fails', function (done) {
		this.timeout(5000);
		this.slow(4000);

		Dispatcher.register('/appcd/config/network', ctx => {
			throw new Error('oh no!');
		});

		this.server = http.createServer((req, res) => {
			res.end('foo!');
		});

		this.server.listen(1337, '127.0.0.1', () => {
			request({
				url: 'http://127.0.0.1:1337'
			}, (err, res, body) => {
				try {
					if (err) {
						throw err;
					}
					expect(res.statusCode).to.equal(200);
					expect(body).to.equal('foo!');
					done();
				} catch (e) {
					done(e);
				}
			});
		});
	});

	it('should make http request with default config', function (done) {
		this.timeout(5000);
		this.slow(4000);

		Dispatcher.register('/appcd/config/network', ctx => {
			ctx.response.write({
				type: 'event',
				message: {
					url: 'http://127.0.0.1:1337'
				}
			});
		});

		this.server = http.createServer((req, res) => {
			res.writeHead(200, { 'Content-Length': 4 });
			res.end('foo!');
		});

		this.server.listen(1337, '127.0.0.1', () => {
			// wait 1 second for the default config to load
			setTimeout(() => {
				request({}, (err, res, body) => {
					try {
						if (err) {
							throw err;
						}
						expect(res.statusCode).to.equal(200);
						expect(parseInt(res.headers['content-length'])).to.equal(4);
						expect(body).to.equal('foo!');
						done();
					} catch (e) {
						done(e);
					}
				});
			}, 1000);
		});
	});

	it('should make http request for bad page', function (done) {
		this.server = http.createServer((req, res) => {
			res.writeHead(404, { 'Content-Type': 'text/plain' });
			res.end('Not found!');
		});

		this.server.listen(1337, '127.0.0.1', () => {
			request({
				url: 'http://127.0.0.1:1337'
			}, (err, res, body) => {
				try {
					if (err) {
						throw err;
					}
					expect(res.statusCode).to.equal(404);
					expect(body).to.equal('Not found!');
					done();
				} catch (e) {
					done(e);
				}
			});
		});
	});

	it('should make https request without strict ssl', function (done) {
		this.server = https.createServer({
			key: fs.readFileSync(path.join(__dirname, 'ssl', 'server.key.pem')),
			cert: fs.readFileSync(path.join(__dirname, 'ssl', 'server.chain.pem'))
		}, (req, res) => {
			res.writeHead(200, { 'Content-Length': 4 });
			res.end('foo!');
		});

		this.server.listen(1337, '127.0.0.1', () => {
			request({
				strictSSL: false,
				url: 'https://127.0.0.1:1337'
			}, (err, res, body) => {
				try {
					if (err) {
						throw err;
					}
					expect(res.statusCode).to.equal(200);
					expect(parseInt(res.headers['content-length'])).to.equal(4);
					expect(body).to.equal('foo!');
					done();
				} catch (e) {
					done(e);
				}
			});
		});
	});

	it('should fail making https request with strict ssl', function (done) {
		this.server = https.createServer({
			key: fs.readFileSync(path.join(__dirname, 'ssl', 'server.key.pem')),
			cert: fs.readFileSync(path.join(__dirname, 'ssl', 'server.chain.pem'))
		}, (req, res) => {
			res.end('foo!');
		});

		this.server.listen(1337, '127.0.0.1', () => {
			request({
				url: 'https://127.0.0.1:1337'
			}, (err, res, body) => {
				try {
					if (err) {
						expect(err.message).to.match(/self signed/);
						done();
					} else {
						done(new Error('Expected request to fail'));
					}
				} catch (e) {
					console.log('!!!!', e);
					done(e);
				}
			});
		});
	});

	it('should load certs, ca, and key file in default config', function (done) {
		this.timeout(5000);
		this.slow(4000);

		Dispatcher.register('/appcd/config/network', ctx => {
			ctx.response.write({
				type: 'event',
				message: {
					caFile: path.join(__dirname, 'ssl', 'ca.crt.pem'),
					certFile: path.join(__dirname, 'ssl', 'client.crt.pem'),
					keyFile: path.join(__dirname, 'ssl', 'client.key.pem'),
					strictSSL: false
				}
			});
		});

		this.server = https.createServer({
			ca: fs.readFileSync(path.join(__dirname, 'ssl', 'ca.crt.pem')),
			cert: fs.readFileSync(path.join(__dirname, 'ssl', 'server.crt.pem')),
			key: fs.readFileSync(path.join(__dirname, 'ssl', 'server.key.pem')),
			requestCert: true
		}, (req, res) => {
			if (!req.client.authorized) {
				res.writeHead(401, { 'Content-Type': 'text/plain' });
				res.end('Client cert required');
				return;
			}

			let cert = req.connection.getPeerCertificate();
			if (!cert || !Object.keys(cert).length) {
				res.writeHead(500, { 'Content-Type': 'text/plain' });
				res.end('Client cert was authenticated, but no cert!');
				return;
			}

			res.writeHead(200, { 'Content-Length': 4 });
			res.end('foo!');
		});

		this.server.listen(1337, '127.0.0.1', () => {
			// wait 1 second for the default config to load
			setTimeout(() => {
				request({
					url: 'https://127.0.0.1:1337'
				}, (err, res, body) => {
					try {
						if (err) {
							throw err;
						}
						expect(res.statusCode).to.equal(200);
						expect(parseInt(res.headers['content-length'])).to.equal(4);
						expect(body).to.equal('foo!');
						done();
					} catch (e) {
						done(e);
					}
				});
			}, 1000);
		});
	});

	it('should proxy http request', function (done) {
		this.timeout(5000);
		this.slow(4000);

		Dispatcher.register('/appcd/config/network', ctx => {
			ctx.response.write({
				type: 'event',
				message: {
					httpProxy: 'http://127.0.0.1:1337'
				}
			});
		});

		this.server = http.createServer((req, res) => {
			if (req.headers.host === '127.0.0.1:1338') {
				res.writeHead(200, { 'Content-Length': 4 });
				res.end('foo!');
			} else {
				res.writeHead(400, { 'Content-Type': 'text/plain' });
				res.end('Wrong host!');
			}
		});

		this.server.listen(1337, '127.0.0.1', () => {
			// wait 1 second for the default config to load
			setTimeout(() => {
				request({
					url: 'http://127.0.0.1:1338'
				}, (err, res, body) => {
					try {
						if (err) {
							throw err;
						}
						expect(res.statusCode).to.equal(200);
						expect(parseInt(res.headers['content-length'])).to.equal(4);
						expect(body).to.equal('foo!');
						done();
					} catch (e) {
						done(e);
					}
				});
			}, 1000);
		});
	});

	it('should proxy https request', function (done) {
		this.timeout(5000);
		this.slow(4000);

		Dispatcher.register('/appcd/config/network', ctx => {
			ctx.response.write({
				type: 'event',
				message: {
					httpsProxy: 'https://127.0.0.1:1338',
					strictSSL: false,
					tunnel: false
				}
			});
		});

		this.server = https.createServer({
			ca: fs.readFileSync(path.join(__dirname, 'ssl', 'ca.crt.pem')),
			cert: fs.readFileSync(path.join(__dirname, 'ssl', 'server.crt.pem')),
			key: fs.readFileSync(path.join(__dirname, 'ssl', 'server.key.pem'))
		}, (req, res) => {
			res.writeHead(200, { 'Content-Length': 4 });
			res.end('foo!');
		});

		this.server2 = https.createServer({
			ca: fs.readFileSync(path.join(__dirname, 'ssl', 'ca.crt.pem')),
			cert: fs.readFileSync(path.join(__dirname, 'ssl', 'server.crt.pem')),
			key: fs.readFileSync(path.join(__dirname, 'ssl', 'server.key.pem'))
		}, (req, res) => {
			res.writeHead(200, { 'Content-Length': 4 });
			res.end('foo!');
		});

		Promise
			.all([
				new Promise(resolve => this.server.listen(1337, '127.0.0.1', resolve)),
				new Promise(resolve => this.server2.listen(1338, '127.0.0.1', resolve))
			])
			.then(() => {
				// wait 1 second for the default config to load
				setTimeout(() => {
					request({
						url: 'https://127.0.0.1:1337'
					}, (err, res, body) => {
						try {
							if (err) {
								throw err;
							}
							expect(res.statusCode).to.equal(200);
							expect(parseInt(res.headers['content-length'])).to.equal(4);
							expect(body).to.equal('foo!');
							done();
						} catch (e) {
							done(e);
						}
					});
				}, 1000);
			});
	});
});
