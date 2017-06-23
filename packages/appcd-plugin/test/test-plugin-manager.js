import Dispatcher from 'appcd-dispatcher';
import FSWatchManager from 'appcd-fswatcher';
import path from 'path';
import PluginError from '../dist/plugin-error';
import PluginManager from '../dist/index';
import snooplogg from 'snooplogg';

const log = snooplogg.config({ theme: 'detailed' })('test:appcd:plugin:manager').log;
const { highlight } = snooplogg.styles;

describe('PluginManager', () => {
	before(function () {
		const fm = this.fm = new FSWatchManager();
		Dispatcher.register('/appcd/fs/watch', fm.dispatcher);
	});

	beforeEach(function () {
		this.pm = null;
	});

	afterEach(async function () {
		if (this.pm) {
			await this.pm.shutdown();
			this.pm = null;
		}
	});

	it('should error if options is not an object', () => {
		expect(() => {
			new PluginManager('foo');
		}).to.throw(TypeError, 'Expected options to be an object');
	});

	it('should error if paths option is not an array', () => {
		expect(() => {
			new PluginManager({
				paths: 'foo'
			});
		}).to.throw(TypeError, 'Expected paths option to be an array');
	});

	it('should not watch when no paths specified', async function () {
		this.pm = new PluginManager();

		expect(Object.keys(this.pm.pluginPaths)).to.have.lengthOf(0);
		expect(this.pm.plugins).to.have.lengthOf(0);

		let stats = this.fm.status();
		expect(stats.nodes).to.equal(0);

		await this.pm.shutdown();
		this.pm = null;

		stats = this.fm.status();
		expect(stats.nodes).to.equal(0);
	});

	it('should error if paths option contains an invalid path', () => {
		expect(() => {
			new PluginManager({ paths: [ {} ] });
		}).to.throw(PluginError, 'Invalid plugin path');
	});

	it('should watch empty path for plugins and shutdown', async function () {
		const dir = path.join(__dirname, 'fixtures', 'empty');
		this.pm = new PluginManager({ paths: [ '', null, dir ] });

		expect(Object.keys(this.pm.pluginPaths)).to.have.lengthOf(1);
		expect(this.pm.plugins).to.have.lengthOf(0);

		await this.pm.shutdown();
		this.pm = null;

		const stats = this.fm.status();
		expect(stats.nodes).to.equal(0);
	});

	it('should error if plugin path is already registered', async function () {
		const dir = path.join(__dirname, 'fixtures', 'empty');
		this.pm = new PluginManager({ paths: [ '', null, dir ] });

		expect(Object.keys(this.pm.pluginPaths)).to.have.lengthOf(1);
		expect(this.pm.plugins).to.have.lengthOf(0);

		expect(() => {
			this.pm.register(dir);
		}).to.throw(PluginError, 'Plugin Path Already Registered');

		await this.pm.shutdown();
		this.pm = null;

		const stats = this.fm.status();
		expect(stats.nodes).to.equal(0);
	});

	it('should error if registering a subdirectory of already registered path', async function () {
		const dir = path.join(__dirname, 'fixtures', 'empty');
		this.pm = new PluginManager({ paths: [ dir ] });

		expect(() => {
			this.pm.register(__dirname);
		}).to.throw(PluginError, 'Plugin Path Subdirectory Already Registered');

		await this.pm.shutdown();
		this.pm = null;
	});

	it('should error if registering a parent directory of already registered path', async function () {
		const dir = path.join(__dirname, 'fixtures', 'empty');
		this.pm = new PluginManager({ paths: [ dir ] });

		expect(() => {
			this.pm.register(path.join(dir, 'foo'));
		}).to.throw(PluginError, 'Plugin Path Parent Directory Already Registered');

		await this.pm.shutdown();
		this.pm = null;
	});

	it('should error unregistering if plugin path is invalid', function (done) {
		this.pm = new PluginManager;

		this.pm.unregister(null)
			.then(() => {
				done(new Error('Expected error'));
			})
			.catch(err => {
				expect(err).to.be.instanceof(PluginError);
				expect(err.message).to.equal('Invalid plugin path');
				done();
			})
			.catch(done);
	});

	it('should error unregistering if plugin path is not registered', function (done) {
		const dir = path.join(__dirname, 'fixtures', 'empty');
		this.pm = new PluginManager;

		this.pm.unregister(dir)
			.then(() => {
				done(new Error('Expected error'));
			})
			.catch(err => {
				expect(err).to.be.instanceof(PluginError);
				expect(err.message).to.equal('Plugin Path Not Registered');
				done();
			})
			.catch(done);
	});

	it.skip('should register a plugin and start it', async function () {
		this.timeout(10000);
		this.slow(9000);

		this.pm = new PluginManager({
			paths: [ path.join(__dirname, 'fixtures', 'good') ]
		});

		await this.pm.shutdown();
		this.pm = null;

		const stats = this.fm.status();
		expect(stats.nodes).to.equal(0);
	});
});
