import appcdLogger from 'appcd-logger';
import Config from 'appcd-config';
import Dispatcher from 'appcd-dispatcher';
import fs from 'fs-extra';
import http from 'http';
import path from 'path';
import Telemetry from '../dist/telemetry';
import tmp from 'tmp';

import { codes } from 'appcd-response';
import { sleep } from 'appcd-util';

const { log } = appcdLogger('test:appcd:telemetry');

const tmpDir = tmp.dirSync({
	prefix: 'appcd-telemetry-test-',
	unsafeCleanup: true
}).name;

function makeTempName() {
	return path.join(tmpDir, Math.random().toString(36).substring(7));
}

function makeTempDir() {
	const dir = makeTempName();
	fs.mkdirsSync(dir);
	return dir;
}

describe('telemetry', () => {
	after(() => {
		fs.removeSync(tmpDir);
	});

	describe('constructor', () => {
		it('should error if config is invalid', () => {
			expect(() => {
				new Telemetry();
			}).to.throw(TypeError, 'Expected config to be a valid config object');

			expect(() => {
				new Telemetry(null);
			}).to.throw(TypeError, 'Expected config to be a valid config object');

			expect(() => {
				new Telemetry('foo');
			}).to.throw(TypeError, 'Expected config to be a valid config object');
		});

		it('should error if the config doesn\'t contain an app guid', () => {
			const cfg = new Config({
				config: {
					foo: 'bar'
				}
			});

			expect(() => {
				new Telemetry(cfg);
			}).to.throw(Error, 'Config is missing a required, valid "appcd.guid"');
		});
	});

	describe('Config', () => {
		it('should init config with defaults', () => {
			const telemetry = createTelemetry();
			expect(telemetry.config).to.be.an('object');
			expect(telemetry.config.enabled).to.be.false;
			expect(telemetry.config.eventsDir).to.be.null;
			expect(telemetry.config.sendBatchSize).to.equal(10);
			expect(telemetry.config.url).to.be.null;
		});

		it('should init config with custom settings', function () {
			const eventsDir = makeTempName();
			const telemetry = this.telemetry = createTelemetry({
				telemetry: {
					enabled: true,
					eventsDir,
					sendBatchSize: 20,
					url: 'foo'
				}
			});
			expect(telemetry.config).to.be.an('object');
			expect(telemetry.config.enabled).to.be.true;
			expect(telemetry.config.eventsDir).to.equal(eventsDir);
			expect(telemetry.config.sendBatchSize).to.equal(20);
			expect(telemetry.config.url).to.equal('foo');
		});
	});

	describe('Initialization', () => {
		afterEach(async function () {
			if (this.telemetry) {
				await this.telemetry.shutdown();
				this.telemetry = null;
			}
		});

		it('should error if not initialized', function (done) {
			const telemetry = this.telemetry = createTelemetry({
				telemetry: {
					enabled: true,
					eventsDir: makeTempName()
				}
			});

			new Dispatcher()
				.register('/appcd/telemetry', telemetry)
				.call('/appcd/telemetry', {
					type: 'test'
				})
				.then(ctx => {
					expect(ctx.response.status).to.equal(codes.SERVER_ERROR);
					expect(ctx.response.statusCode).to.equal(codes.NOT_INITIALIZED);
					expect(ctx.response.message).to.equal('The telemetry system has not been initialized');
					done();
				})
				.catch(done);
		});

		it('should error if home dir is not valid', function (done) {
			const telemetry = this.telemetry = createTelemetry({
				telemetry: {
					enabled: true,
					eventsDir: makeTempName()
				}
			});

			telemetry.init({})
				.then(() => {
					throw new Error('Expected type error');
				}, err => {
					expect(err).to.be.instanceof(TypeError);
					expect(err.message).to.equal('Expected home directory to be a non-empty string');
					done();
				})
				.catch(done);
		});

		it('should not re-initialize', function (done) {
			const telemetry = this.telemetry = createTelemetry({
				telemetry: {
					enabled: true,
					eventsDir: makeTempName()
				}
			});

			expect(telemetry.mid).to.be.null;
			telemetry.init(makeTempDir())
				.then(() => {
					expect(telemetry.mid).to.be.a('string');
					expect(telemetry.mid).to.not.equal('');
					return telemetry.init(); // would throw a TypeError if no homeDir
				})
				.then(() => done())
				.catch(done);
		});
	});

	describe('Store Events', () => {
		afterEach(async function () {
			if (this.telemetry) {
				await this.telemetry.shutdown();
				this.telemetry = null;
			}
		});

		it('should accept request even when telemetry is disabled', async function () {
			const telemetry = this.telemetry = await createInitializedTelemetry({
				telemetry: {
					enabled: false
				}
			});

			return new Dispatcher()
				.register('/appcd/telemetry', telemetry)
				.call('/appcd/telemetry', {
					event: 'test'
				})
				.then(ctx => {
					expect(ctx.response.status).to.equal(codes.ACCEPTED);
					expect(ctx.response.statusCode).to.equal(codes.TELEMETRY_DISABLED);
				});
		});

		it('should error if event is invalid', async function () {
			const telemetry = this.telemetry = await createInitializedTelemetry();
			return new Dispatcher()
				.register('/appcd/telemetry', telemetry)
				.call('/appcd/telemetry', {
					event: []
				})
				.then(ctx => {
					expect(ctx.response.status).to.equal(codes.BAD_REQUEST);
				});

		});

		it('should write event to disk', async function () {
			const eventsDir = makeTempDir();
			const telemetry = this.telemetry = await createInitializedTelemetry({
				telemetry: {
					eventsDir
				}
			});

			return new Dispatcher()
				.register('/appcd/telemetry', telemetry)
				.call('/appcd/telemetry', {
					event: 'test',
					foo: 'bar'
				})
				.then(ctx => {
					expect(ctx.response.statusCode).to.equal(codes.CREATED);
					expect(fs.readdirSync(eventsDir)).to.have.lengthOf(1);
				});
		});

		it('should stop writing events if event dir is nulled', async function () {
			const eventsDir = makeTempDir();

			const cfg = new Config({
				config: {
					appcd: {
						guid: '<GUID>'
					},
					telemetry: {
						enabled: true,
						eventsDir
					}
				}
			});

			const telemetry = this.telemetry = new Telemetry(cfg);

			await telemetry.init(makeTempDir());

			const dispatcher = new Dispatcher();

			return dispatcher
				.register('/appcd/telemetry', telemetry)
				.call('/appcd/telemetry', {
					event: 'test',
					foo: 'bar'
				})
				.then(ctx => {
					expect(ctx.response.statusCode).to.equal(codes.CREATED);
					expect(fs.readdirSync(eventsDir)).to.have.lengthOf(1);

					cfg.set('telemetry.eventsDir', null);

					return dispatcher.call('/appcd/telemetry', {
						event: 'test',
						foo: 'bar'
					});
				})
				.then(ctx => {
					expect(ctx.response.statusCode).to.equal(codes.TELEMETRY_DISABLED);
					expect(fs.readdirSync(eventsDir)).to.have.lengthOf(1);

					cfg.set('telemetry.eventsDir', eventsDir);

					return dispatcher.call('/appcd/telemetry', {
						event: 'test',
						foo: 'bar'
					});
				})
				.then(ctx => {
					expect(ctx.response.statusCode).to.equal(codes.CREATED);
					expect(fs.readdirSync(eventsDir)).to.have.lengthOf(2);
				});
		});

		it('should fallback to writing event to home events dir', async function () {
			const telemetry = this.telemetry = createTelemetry({
				telemetry: {
					enabled: true
				}
			});

			const homeDir = makeTempDir();
			const eventsDir = path.join(homeDir, 'telemetry');
			await telemetry.init(homeDir);

			return new Dispatcher()
				.register('/appcd/telemetry', telemetry)
				.call('/appcd/telemetry', {
					event: 'test',
					foo: 'bar'
				})
				.then(ctx => {
					expect(ctx.response.statusCode).to.equal(codes.CREATED);
					expect(fs.readdirSync(eventsDir)).to.have.lengthOf(1);
				});
		});
	});

	describe('Sending Events', () => {
		afterEach(function (done) {
			Promise.resolve()
				.then(async () => {
					if (this.telemetry) {
						await this.telemetry.shutdown();
						this.telemetry = null;
					}
				})
				.then(() => {
					if (this.server) {
						return new Promise(resolve => {
							this.server.close(() => {
								this.server = null;
								resolve();
							});
						});
					}
				})
				.then(() => sleep(1000))
				.then(() => done())
				.catch(done);
		});

		it('should send events to the server', async function () {
			this.timeout(10000);
			this.slow(10000);

			let counter = 0;

			this.server = http.createServer((req, res) => {
				counter++;
				log('Receiving HTTP request');
				res.writeHead(200, { 'Content-Type': 'text/plain' });
				res.end('okay');
			}).listen(1337);

			let i = 0;
			const eventsDir = makeTempDir();
			const telemetry = this.telemetry = await createInitializedTelemetry({
				telemetry: {
					eventsDir,
					sendBatchSize: 5,
					sendInterval: 3000, // 3 seconds
					url: 'http://127.0.0.1:1337'
				}
			});

			const dispatcher = new Dispatcher()
				.register('/appcd/telemetry', telemetry);

			const addEvent = () => {
				return dispatcher
					.call('/appcd/telemetry', {
						event: 'test',
						foo: `bar${++i}`
					});
			};

			return Promise
				.all([
					addEvent(),
					addEvent(),
					addEvent()
				])
				.then(() => {
					expect(fs.readdirSync(eventsDir)).to.have.lengthOf(3);
					expect(counter).to.equal(0);
					return sleep(3500);
				})
				.then(() => {
					return Promise
						.all([
							addEvent(),
							addEvent()
						]);
				})
				.then(() => {
					expect(fs.readdirSync(eventsDir)).to.have.lengthOf(2);
					expect(counter).to.equal(1);
					return sleep(3500);
				})
				.then(() => {
					expect(fs.readdirSync(eventsDir)).to.have.lengthOf(0);
					expect(counter).to.equal(2);
				});
		});

		it('should not delete events if the server fails', async function () {
			this.timeout(10000);
			this.slow(10000);

			let counter = 0;

			this.server = http.createServer((req, res) => {
				counter++;
				log('Receiving HTTP request');
				res.writeHead(500, { 'Content-Type': 'text/plain' });
				res.end('server error');
			}).listen(1337);

			const eventsDir = makeTempDir();
			const telemetry = this.telemetry = await createInitializedTelemetry({
				telemetry: {
					eventsDir,
					sendBatchSize: 5,
					sendInterval: 3000, // 3 seconds
					url: 'http://127.0.0.1:1337'
				}
			});

			return new Dispatcher()
				.register('/appcd/telemetry', telemetry)
				.call('/appcd/telemetry', {
					event: 'test',
					foo: 'bar'
				})
				.then(() => {
					expect(fs.readdirSync(eventsDir)).to.have.lengthOf(1);
					expect(counter).to.equal(0);
					return sleep(3500);
				})
				.then(() => {
					expect(fs.readdirSync(eventsDir)).to.have.lengthOf(1);
					expect(counter).to.equal(1);
				});
		});

		it('should not delete events if the request fails', async function () {
			this.timeout(10000);
			this.slow(10000);

			const eventsDir = makeTempDir();
			const telemetry = this.telemetry = await createInitializedTelemetry({
				telemetry: {
					eventsDir,
					sendBatchSize: 5,
					sendInterval: 3000, // 3 seconds
					timeout: 1000,
					url: 'http://127.0.0.1:1338'
				}
			});

			return new Dispatcher()
				.register('/appcd/telemetry', telemetry)
				.call('/appcd/telemetry', {
					event: 'test',
					foo: 'bar'
				})
				.then(() => sleep(3500))
				.then(() => {
					expect(fs.readdirSync(eventsDir)).to.have.lengthOf(1);
				});
		});

		it('should not delete events if telemetry not enabled', async function () {
			this.timeout(10000);
			this.slow(10000);

			const eventsDir = makeTempDir();
			const telemetry = this.telemetry = await createInitializedTelemetry({
				telemetry: {
					eventsDir,
					url: null
				}
			});

			return new Dispatcher()
				.register('/appcd/telemetry', telemetry)
				.call('/appcd/telemetry', {
					event: 'test',
					foo: 'bar'
				})
				.then(() => sleep(3500))
				.then(() => {
					expect(fs.readdirSync(eventsDir)).to.have.lengthOf(1);
				});
		});

		it('should send events in batches', async function () {
			this.timeout(10000);
			this.slow(10000);

			let counter = 0;

			this.server = http.createServer((req, res) => {
				counter++;
				log('Receiving HTTP request');
				res.writeHead(200, { 'Content-Type': 'text/plain' });
				res.end('okay');
			}).listen(1337);

			let i = 0;
			const eventsDir = makeTempDir();
			const telemetry = this.telemetry = await createInitializedTelemetry({
				telemetry: {
					eventsDir,
					sendBatchSize: 5,
					sendInterval: 3000, // 3 seconds
					url: 'http://127.0.0.1:1337'
				}
			});

			const dispatcher = new Dispatcher()
				.register('/appcd/telemetry', telemetry);

			const addEvent = () => {
				return dispatcher
					.call('/appcd/telemetry', {
						event: 'test',
						foo: `bar${++i}`
					});
			};

			return Promise
				.all([
					addEvent(),
					addEvent(),
					addEvent(),
					addEvent(),
					addEvent(),

					addEvent(),
					addEvent(),
					addEvent(),
					addEvent(),
					addEvent(),

					addEvent(),
					addEvent()
				])
				.then(() => {
					expect(fs.readdirSync(eventsDir)).to.have.lengthOf(12);
					expect(counter).to.equal(0);
					return sleep(3500);
				})
				.then(() => {
					expect(fs.readdirSync(eventsDir)).to.have.lengthOf(0);
					expect(counter).to.equal(3);
				});
		});

		it('should keep checking for new events', async function () {
			this.timeout(10000);
			this.slow(10000);

			let counter = 0;

			this.server = http.createServer((req, res) => {
				counter++;
				log('Receiving HTTP request');
				res.writeHead(200, { 'Content-Type': 'text/plain' });
				res.end('okay');
			}).listen(1337);

			const eventsDir = makeTempDir();
			const telemetry = this.telemetry = await createInitializedTelemetry({
				telemetry: {
					eventsDir,
					sendBatchSize: 5,
					sendInterval: 3000, // 3 seconds
					url: 'http://127.0.0.1:1337'
				}
			});

			const dispatcher = new Dispatcher()
				.register('/appcd/telemetry', telemetry);

			await sleep(3500);

			expect(fs.readdirSync(eventsDir)).to.have.lengthOf(0);
			expect(counter).to.equal(0);

			return dispatcher
				.call('/appcd/telemetry', {
					event: 'test'
				})
				.then(() => {
					expect(fs.readdirSync(eventsDir)).to.have.lengthOf(1);
					expect(counter).to.equal(0);
					return sleep(3500);
				})
				.then(() => {
					expect(fs.readdirSync(eventsDir)).to.have.lengthOf(0);
					expect(counter).to.equal(1);
				});
		});
	});

	describe('Shutdown', () => {
		afterEach(function (done) {
			Promise.resolve()
				.then(async () => {
					if (this.telemetry) {
						await this.telemetry.shutdown();
						this.telemetry = null;
					}
				})
				.then(() => {
					if (this.server) {
						return new Promise(resolve => {
							this.server.close(() => {
								this.server = null;
								resolve();
							});
						});
					}
				})
				.then(() => sleep(1000))
				.then(() => done())
				.catch(done);
		});

		it('should wait for pending request when shutting down', async function () {
			this.timeout(10000);
			this.slow(10000);

			let counter = 0;

			this.server = http.createServer((req, res) => {
				log('Receiving HTTP request, waiting 3 seconds...');
				setTimeout(() => {
					counter++;
					res.writeHead(200, { 'Content-Type': 'text/plain' });
					res.end('okay');
				}, 3000);
			}).listen(1337);

			const eventsDir = makeTempDir();
			const telemetry = this.telemetry = await createInitializedTelemetry({
				telemetry: {
					eventsDir,
					sendInterval: 1000, // 1 second
					url: 'http://127.0.0.1:1337'
				}
			});

			return new Dispatcher()
				.register('/appcd/telemetry', telemetry)
				.call('/appcd/telemetry', {
					event: 'test',
					foo: 'bar'
				})
				.then(async () => {
					expect(fs.readdirSync(eventsDir)).to.have.lengthOf(1);

					// wait for telemetry to send the event
					await sleep(1000);

					// time the shutdown
					const now = Date.now();
					log('Shutting down');
					await this.telemetry.shutdown();
					const delta = Date.now() - now;

					// make sure the server was called
					expect(counter).to.equal(1);

					// make sure it took around 3 seconds to complete
					expect(delta).to.be.at.least(2500);
					expect(delta).to.be.at.most(3500);

					// make sure the event file was removed
					expect(fs.readdirSync(eventsDir)).to.have.lengthOf(0);
				});
		});
	});
});

function createTelemetry(json) {
	if (!json) {
		json = {};
	}
	if (!json.appcd) {
		json.appcd = {};
	}
	if (!json.appcd.guid) {
		json.appcd.guid = '<GUID>';
	}
	const cfg = new Config({ config: json });
	return new Telemetry(cfg);
}

function createInitializedTelemetry(json) {
	if (!json) {
		json = {};
	}
	if (!json.telemetry) {
		json.telemetry = {};
	}
	if (json.telemetry.enabled === undefined) {
		json.telemetry.enabled = true;
	}
	return createTelemetry(json).init(makeTempDir());
}
