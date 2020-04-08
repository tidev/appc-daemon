import path from 'path';
import PluginError from '../dist/plugin-error';
import Plugin from '../dist/plugin';

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

	it('should error if package.json has an invalid name', () => {
		expect(() => {
			new Plugin(path.join(__dirname, 'fixtures', 'bad-name'));
		}).to.throw(PluginError, /^Invalid "name" property in /);
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

	it('should error if package.json has an invalid "appcd-plugin" property', () => {
		expect(() => {
			new Plugin(path.join(__dirname, 'fixtures', 'bad-appcd-plugin-object'));
		}).to.throw(PluginError, /^Expected "appcd-plugin" section to be an object in /);
	});

	it('should error if package.json has an invalid "appcd" property', () => {
		expect(() => {
			new Plugin(path.join(__dirname, 'fixtures', 'bad-appcd-object'));
		}).to.throw(PluginError, /^Expected "appcd" section to be an object in /);
	});

	it('should error if package.json has an invalid appcd "name" property', () => {
		expect(() => {
			new Plugin(path.join(__dirname, 'fixtures', 'bad-appcd-name'));
		}).to.throw(PluginError, /^Invalid "name" property in the "appcd" section of /);
	});

	it('should error if package.json appcd "type" is invalid', () => {
		expect(() => {
			new Plugin(path.join(__dirname, 'fixtures', 'bad-appcd-type'));
		}).to.throw(PluginError, /^Invalid type "foo" in "appcd" section of /);
	});

	it('should error if package.json appcd "inactivityTimeout" is invalid', () => {
		expect(() => {
			new Plugin(path.join(__dirname, 'fixtures', 'bad-inactivity-timeout'));
		}).to.throw(PluginError, 'Expected inactivity timeout to be a non-negative number');
	});

	it('should error if plugin has an invalid name', () => {
		expect(() => {
			new Plugin(path.join(__dirname, 'fixtures', 'no-name'));
		}).to.throw(PluginError, /^Invalid "name" property in the "appcd" section of /);
	});

	it('should error if package.json has appcd "name" of "appcd"', () => {
		expect(() => {
			new Plugin(path.join(__dirname, 'fixtures', 'bad-appcd-name2'));
		}).to.throw(PluginError, 'Plugin forbidden from using the name "appcd"');
	});

	it('should capture error if node.js version is incorrect', () => {
		const p = new Plugin(path.join(__dirname, 'fixtures', 'wrong-node-ver'));
		expect(p.error).to.match(/Internal plugin requires Node.js 1\.2\.3, but currently running v\d+\.\d+\.\d+$/);
	});

	it('should capture error if api version is incorrect', () => {
		const p = new Plugin(path.join(__dirname, 'fixtures', 'wrong-api-ver'));
		expect(p.error).to.match(/Requires Appc Daemon plugin API 0.x, but currently running v\d+\.\d+\.\d+$/);
	});

	it('should prefer appcd data over appd-plugin', () => {
		const p = new Plugin(path.join(__dirname, 'fixtures', 'both-package-json-entries'));
		expect(p.info.name).to.equal('good');
	});

	it('should find main if no .js extension is specified', () => {
		const pluginPath = path.join(__dirname, 'fixtures', 'good-main-nojs');
		const p = new Plugin(pluginPath);
		const nodeVersion = process.version.replace(/^v/, '');

		expect(p.path).to.equal(pluginPath);
		expect(p.name).to.equal('good-main-nojs');
		expect(p.version).to.equal('1.2.3');
		expect(p.main).to.equal(path.join(pluginPath, 'foo.js'));
		expect(p.type).to.equal('external');
		expect(p.pid).to.be.undefined;
		expect(p.nodeVersion).to.equal(nodeVersion);
		expect(p.error).to.be.null;

		expect(p.info).to.have.keys('activeRequests', 'apiVersion', 'appcdVersion', 'dependencies', 'description', 'error', 'homepage', 'license', 'main', 'name', 'nodeVersion', 'os', 'packageName', 'path', 'supported', 'totalRequests', 'type', 'version');
		expect(p.info.activeRequests).to.equal(0);
		expect(p.info.dependencies).to.be.an('object');
		expect(p.info.error).to.be.null;
		expect(p.info.main).to.be.equal(path.join(pluginPath, 'foo.js'));
		expect(p.info.name).to.be.equal('good-main-nojs');
		expect(p.info.nodeVersion).to.be.equal(nodeVersion);
		expect(p.info.packageName).to.be.equal('good-main-nojs');
		expect(p.info.path).to.be.equal(pluginPath);
		expect(p.info.supported).to.be.equal(true);
		expect(p.info.totalRequests).to.be.equal(0);
		expect(p.info.type).to.be.equal('external');
		expect(p.info.version).to.be.equal('1.2.3');
	});

	it('should error if trying to set plugin info prop', () => {
		expect(() => {
			const p = new Plugin(path.join(__dirname, 'fixtures', 'good'));
			p.info = 'foo';
		}).to.throw(Error, 'The "info" property is readonly');
	});

	it('should build a list of directories to watch', () => {
		const pluginPath = path.join(__dirname, 'fixtures', 'good-dirs');
		const p = new Plugin(pluginPath);
		const dirs = Array.from(p.directories);
		expect(dirs).to.deep.equal([
			pluginPath,
			path.join(pluginPath, 'src'),
			path.join(pluginPath, 'lib')
		]);
	});
});
