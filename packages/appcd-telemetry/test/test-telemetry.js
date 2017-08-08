import Config from 'appcd-config';
import fs from 'fs-extra';
import gawk from 'gawk';
import path from 'path';
import Telemetry from '../dist/telemetry';
import tmp from 'tmp';

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
	});

	describe('Store Event', () => {
		it('should initialize the telemetry system with defaults', () => {
			const telemetry = createTelemetryService();
			expect(telemetry.config).to.be.an('object');
			expect(telemetry.config.enabled).to.be.false;
			expect(telemetry.config.eventsDir).to.be.null;
			expect(telemetry.config.sendBatchSize).to.equal(10);
			expect(telemetry.config.url).to.be.null;
		});

		it('should initialize the telemetry system with config', () => {
			const eventsDir = makeTempName();
			const telemetry = createTelemetryService({
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
});

function createTelemetryService(json) {
	const cfg = new Config({ config: json });
	cfg.values = gawk(cfg.values);
	return new Telemetry(cfg);
}
