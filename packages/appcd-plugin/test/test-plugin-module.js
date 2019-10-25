import os from 'os';
import path from 'path';
import PluginModule from '../dist/plugin-module';

function MockPlugin() {
	this.globals = {};
}

describe('Plugin Module', () => {
	let plugin;

	beforeEach(() => {
		plugin = new MockPlugin();
	});

	afterEach(() => {
		plugin = null;
	});

	it('should load a vanilla js file', () => {
		const exports = PluginModule.load(plugin, path.join(__dirname, 'fixtures', 'vanilla.js'));
		expect(exports).to.deep.equal({ foo: 'bar' });
	});

	it('should load a js file that requires a vanilla js file', () => {
		const exports = PluginModule.load(plugin, path.join(__dirname, 'fixtures', 'req.js'));
		expect(exports).to.deep.equal({ foo: 'bar' });
	});

	it('should fail to load if js file requires a non-existent file', () => {
		expect(() => {
			PluginModule.load(plugin, path.join(__dirname, 'fixtures', 'bad-req.js'));
		}).to.throw(Error, 'Failed to load plugin: Cannot find module \'does_not_exist\'');
	});

	it('should load js file that requires built-in module', () => {
		const exports = PluginModule.load(plugin, path.join(__dirname, 'fixtures', 'req-builtin.js'));
		expect(exports).to.equal(os.hostname());
	});

	it('should load js file that requires a 3rd party module', () => {
		const exports = PluginModule.load(plugin, path.join(__dirname, 'fixtures', 'req-3rd-party.js'));
		expect(exports).to.equal(os.hostname());
	});

	it('should provide Node.js compatible require api', () => {
		const testModule = path.join(__dirname, 'fixtures', 'require-api.js');
		const exports = PluginModule.load(plugin, testModule);
		expect(exports.main).to.equal(process.mainModule);
		expect(exports.resolved).to.equal(require.resolve('fs-extra'));
		expect(exports.resolvedWithOptions).to.equal(require.resolve('./fixtures/require-api'));
		const paths = require.resolve.paths('fs-extra');
		// manually add fixtures subpath
		paths.unshift(path.join(path.dirname(testModule), 'node_modules'));
		expect(exports.paths).to.eql(paths);
	});
});
