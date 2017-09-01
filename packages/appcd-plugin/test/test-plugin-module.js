import os from 'os';
import path from 'path';
import PluginModule from '../dist/plugin-module';

function MockPlugin() {
	this.globals = {};
}

describe('Plugin Module', () => {
	it('should load a vanilla js file', () => {
		const plugin = new MockPlugin();
		const exports = PluginModule.load(plugin, path.join(__dirname, 'fixtures', 'vanilla.js'));
		expect(exports).to.deep.equal({ foo: 'bar' });
	});

	it('should load a js file that requires a vanilla js file', () => {
		const plugin = new MockPlugin();
		const exports = PluginModule.load(plugin, path.join(__dirname, 'fixtures', 'req.js'));
		expect(exports).to.deep.equal({ foo: 'bar' });
	});

	it('should fail to load if js file requires a non-existent file', () => {
		const plugin = new MockPlugin();
		expect(() => {
			PluginModule.load(plugin, path.join(__dirname, 'fixtures', 'bad-req.js'));
		}).to.throw(Error, 'Failed to load plugin: Cannot find module \'does_not_exist\'');
	});

	it('should load js file that requires built-in module', () => {
		const plugin = new MockPlugin();
		const exports = PluginModule.load(plugin, path.join(__dirname, 'fixtures', 'req-builtin.js'));
		expect(exports).to.equal(os.hostname());
	});

	it('should load js file that requires a 3rd party module', () => {
		const plugin = new MockPlugin();
		const exports = PluginModule.load(plugin, path.join(__dirname, 'fixtures', 'req-3rd-party.js'));
		expect(exports).to.equal(os.hostname());
	});
});
