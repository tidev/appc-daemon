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
		await this.pm.start();

		expect(this.pm.paths).to.have.lengthOf(0);
		expect(this.pm.plugins).to.have.lengthOf(0);

		let stats = this.fm.status();
		expect(stats.nodes).to.equal(0);

		await this.pm.shutdown();
		this.pm = null;

		stats = this.fm.status();
		expect(stats.nodes).to.equal(0);
	});

	it('should watch empty path for plugins and shutdown', async function () {
		const dir = path.join(__dirname, 'fixtures', 'empty');
		this.pm = new PluginManager({ paths: [ '', null, dir ] });
		await this.pm.start();

		expect(this.pm.paths).to.have.lengthOf(1);
		expect(this.pm.plugins).to.have.lengthOf(0);

		let stats = this.fm.status();
		expect(stats.nodes).to.be.above(0);

		await this.pm.shutdown();
		this.pm = null;

		stats = this.fm.status();
		expect(stats.nodes).to.equal(0);
	});

	it('should skip plugin detection if plugin path does not exist', async function () {
		const dir = path.join(__dirname, 'does_not_exist');
		this.pm = new PluginManager({ paths: [ dir ] });
		await this.pm.start();

		expect(this.pm.paths).to.have.lengthOf(1);
		expect(this.pm.plugins).to.have.lengthOf(0);

		let stats = this.fm.status();
		expect(stats.nodes).to.be.above(0);

		await this.pm.shutdown();
		this.pm = null;

		stats = this.fm.status();
		expect(stats.nodes).to.equal(0);
	});

	it('should register a valid plugin', async function () {
		const dir = path.join(__dirname, 'fixtures', 'good');
		this.pm = new PluginManager({ paths: [ dir ] });
		await this.pm.start();

		expect(this.pm.paths).to.have.lengthOf(1);
		expect(this.pm.plugins).to.have.lengthOf(1);

		expect(this.pm.namespaces).to.have.property('good');
		expect(this.pm.namespaces.good).to.be.an('object');

		await this.pm.shutdown();
		this.pm = null;
	});

	it('should error if plugin is already registered', async function () {
		const dir = path.join(__dirname, 'fixtures', 'good');
		this.pm = new PluginManager({ paths: [ dir ] });
		await this.pm.start();

		expect(this.pm.paths).to.have.lengthOf(1);
		expect(this.pm.plugins).to.have.lengthOf(1);

		expect(() => {
			this.pm.register(dir);
		}).to.throw(PluginError);

		await this.pm.shutdown();
		this.pm = null;
	});
});
