import Config from 'appcd-config';
import Dispatcher from 'appcd-dispatcher';
import fs from 'fs-extra';
import gawk from 'gawk';
import path from 'path';
import Telemetry from '../dist/telemetry';
import tmp from 'tmp';

import { codes } from 'appcd-response';

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

		it('should error if config values are not gawked', () => {
			const cfg = new Config({
				config: {
					foo: 'bar'
				}
			});

			expect(() => {
				new Telemetry(cfg);
			}).to.throw(TypeError, 'Expected config values to be gawked');
		});

		it('should error if the config doesn\'t contain an app guid', () => {
			const cfg = new Config({
				config: {
					foo: 'bar'
				}
			});
			cfg.values = gawk(cfg.values);

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
	});

	describe('Sending Events', () => {
		// TODO
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
	cfg.values = gawk(cfg.values);
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
