import path from 'path';
import PluginError from '../dist/plugin-error';
import Plugin from '../dist/plugin';
import snooplogg from 'snooplogg';

const log = snooplogg.config({ theme: 'detailed' })('test:appcd:plugin').log;
const { highlight } = snooplogg.styles;

describe('Plugin', () => {
	it('should error if plugin path is invalid', () => {
		expect(() => {
			new Plugin();
		}).to.throw(PluginError, 'Expected plugin path to be a non-empty string');

		expect(() => {
			new Plugin('');
		}).to.throw(PluginError, 'Expected plugin path to be a non-empty string');

		expect(() => {
			new Plugin(123);
		}).to.throw(PluginError, 'Expected plugin path to be a non-empty string');
	});

	it('should error if plugin path does not exist', () => {
		expect(() => {
			new Plugin(path.join(__dirname, 'does_not_exist'));
		}).to.throw(PluginError, /^Plugin path does not exist: /);
	});

	it('should error if plugin doesn\'t have a package.json', () => {
		expect(() => {
			new Plugin(path.join(__dirname, 'fixtures', 'empty'));
		}).to.throw(PluginError, /^Plugin path does not contain a package\.json: /);
	});

	it('should error if plugin has malformed package.json', () => {
		expect(() => {
			new Plugin(path.join(__dirname, 'fixtures', 'bad-pkgjson'));
		}).to.throw(PluginError, /^Error parsing /);
	});

	it('should error if package.json doesn\'t have a "name" property', () => {
		expect(() => {
			new Plugin(path.join(__dirname, 'fixtures', 'no-name'));
		}).to.throw(PluginError, /^Missing "name" property in /);
	});

	it('should error if package.json doesn\'t have a "version" property', () => {
		expect(() => {
			new Plugin(path.join(__dirname, 'fixtures', 'no-version'));
		}).to.throw(PluginError, /^Missing "version" property in /);
	});

	it('should error if package.json has bad "version" property', () => {
		expect(() => {
			new Plugin(path.join(__dirname, 'fixtures', 'bad-version'));
		}).to.throw(PluginError, /^Invalid version "foo" in /);
	});

	it('should error if unable to find a main js file', () => {
		expect(() => {
			new Plugin(path.join(__dirname, 'fixtures', 'no-main'));
		}).to.throw(PluginError, 'Unable to find main file "main.js"');
	});

	it('should error if unable to find a main index js file', () => {
		expect(() => {
			new Plugin(path.join(__dirname, 'fixtures', 'no-main-index'));
		}).to.throw(PluginError, 'Unable to find main file "index.js"');
	});

	it('should error if package.json doesn\'t have an "appcd-plugin" property', () => {
		expect(() => {
			new Plugin(path.join(__dirname, 'fixtures', 'no-appcd'));
		}).to.throw(PluginError, /^Missing "appcd-plugin" section in /);
	});

	it('should error if package.json missing appcd "name" property', () => {
		expect(() => {
			new Plugin(path.join(__dirname, 'fixtures', 'no-appcd-name'));
		}).to.throw(PluginError, /^Missing "name" property in the "appcd-plugin" section of /);
	});

	it('should error if package.json has appcd "name" of "appcd"', () => {
		expect(() => {
			new Plugin(path.join(__dirname, 'fixtures', 'bad-appcd-name'));
		}).to.throw(PluginError, 'Plugin forbidden from using the name "appcd"');
	});

	it('should error if package.json has appcd "type" is invalid', () => {
		expect(() => {
			new Plugin(path.join(__dirname, 'fixtures', 'bad-appcd-type'));
		}).to.throw(PluginError, /^Invalid type "foo" in "appcd-plugin" section of /);
	});

	it('should capture error if node.js version is incorrect', () => {
		const p = new Plugin(path.join(__dirname, 'fixtures', 'wrong-node-ver'));
		expect(p.error).to.match(/Internal plugin requires Node.js 1\.2\.3, but currently running v\d+\.\d+\.\d+$/);
	});

	it('should find main if no .js extension is specified', () => {
		const pluginPath = path.join(__dirname, 'fixtures', 'good-main-nojs');
		const p = new Plugin(pluginPath);
		expect(p.main).to.equal(path.join(pluginPath, 'foo.js'));
	});
});
