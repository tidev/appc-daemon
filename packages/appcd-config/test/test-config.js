import Config from '../dist/config';
import fs from 'fs-extra';
import path from 'path';
import tmp from 'tmp';

import { real } from 'appcd-path';

const _tmpDir = tmp.dirSync({
	mode: '755',
	prefix: 'appcd-config-test-',
	unsafeCleanup: true
}).name;
const tmpDir = real(_tmpDir);

function makeTempName() {
	return path.join(_tmpDir, Math.random().toString(36).substring(7));
}

function makeTempDir() {
	const dir = makeTempName();
	fs.mkdirsSync(dir);
	return dir;
}

describe('Config', () => {
	after(() => {
		fs.removeSync(tmpDir);
	});

	describe('constructor', () => {
		it('should load blank config', () => {
			const config = new Config();
			expect(config).to.be.instanceof(Config);
			expect(config.toString()).to.equal([
				'{',
				'  "[base]": {},',
				'  "[user]": {},',
				'  "[runtime]": {}',
				'}'
			].join('\n'));
		});

		it('should throw exception for bad base config file', () => {
			expect(function () {
				new Config({ baseConfigFile: 123 });
			}).to.throw(TypeError, 'Expected config file to be a string');

			expect(function () {
				new Config({ baseConfigFile: function () {} });
			}).to.throw(TypeError, 'Expected config file to be a string');

			expect(function () {
				new Config({ baseConfigFile: path.join(__dirname, 'noextension') });
			}).to.throw(Error, 'Config file must be a JavaScript or JSON file');

			expect(function () {
				new Config({ baseConfigFile: path.join(__dirname, 'fixtures', 'bad.json') });
			}).to.throw(Error, /^Failed to load config file: /);

			expect(function () {
				new Config({ baseConfigFile: path.join(__dirname, 'fixtures', 'bad-syntax.js') });
			}).to.throw(Error, /^Failed to load config file: /);

			// NOTE: this test will pass if Node ever supports ECMAScript 2015 modules
			expect(function () {
				new Config({ baseConfigFile: path.join(__dirname, 'fixtures', 'bad-es-export.js') });
			}).to.throw(Error, /^Failed to load config file: /);

			expect(function () {
				new Config({ baseConfigFile: path.join(__dirname, 'fixtures', 'bad-export.js') });
			}).to.throw(Error, 'Expected config file to export an object');
		});

		it('should throw exception for bad config file', () => {
			expect(function () {
				new Config({ configFile: 123 });
			}).to.throw(TypeError, 'Expected config file to be a string');

			expect(function () {
				new Config({ configFile: function () {} });
			}).to.throw(TypeError, 'Expected config file to be a string');

			expect(function () {
				new Config({ configFile: path.join(__dirname, 'noextension') });
			}).to.throw(Error, 'Config file must be a JavaScript or JSON file');

			expect(function () {
				new Config({ configFile: path.join(__dirname, 'fixtures', 'bad.json') });
			}).to.throw(Error, /^Failed to load config file: /);

			expect(function () {
				new Config({ configFile: path.join(__dirname, 'fixtures', 'bad-syntax.js') });
			}).to.throw(Error, /^Failed to load config file: /);

			// NOTE: this test will pass if Node ever supports ECMAScript 2015 modules
			expect(function () {
				new Config({ configFile: path.join(__dirname, 'fixtures', 'bad-es-export.js') });
			}).to.throw(Error, /^Failed to load config file: /);

			expect(function () {
				new Config({ configFile: path.join(__dirname, 'fixtures', 'bad-export.js') });
			}).to.throw(Error, 'Expected config file to export an object');
		});

		it('should throw exception for bad base config', () => {
			expect(() => {
				new Config({ baseConfig: 'foo' });
			}).to.throw(TypeError, 'Expected base config to be an object');

			expect(() => {
				new Config({ baseConfig: [] });
			}).to.throw(TypeError, 'Expected base config to be an object');
		});

		it('should throw exception for bad config', () => {
			expect(() => {
				new Config({ config: 'foo' });
			}).to.throw(TypeError, 'Expected config to be an object');

			expect(() => {
				new Config({ config: [] });
			}).to.throw(TypeError, 'Expected config to be an object');
		});

		it('should load json config file', () => {
			const config = new Config({ configFile: path.join(__dirname, 'fixtures', 'good.json') });
			expect(config.toString(0)).to.equal('{"[base]":{},"[user]":{},"[runtime]":{"name":"foo","age":21,"food":["pizza","tacos"]}}');
		});

		it('should load js config file', () => {
			const config = new Config({ configFile: path.join(__dirname, 'fixtures', 'good.js') });
			expect(config.toString(0)).to.equal('{"[base]":{},"[user]":{},"[runtime]":{"name":"foo","age":21,"food":["pizza","tacos"]}}');
		});

		it('should not error when js config does not export anything', () => {
			expect(function () {
				const config = new Config({ configFile: path.join(__dirname, 'fixtures', 'bad-no-export.js') });
				expect(config.toString(0)).to.equal('{}');
			}).to.not.throw(Error, /^Failed to load config file: /);
		});

		it('should set initial config', () => {
			const config = new Config({
				config: {
					foo: 'bar'
				}
			});
			expect(config.get('foo')).to.equal('bar');
		});

		it('should load js file with shebang', () => {
			new Config({ configFile: path.join(__dirname, 'fixtures', 'shebang.js') });
			new Config({ configFile: path.join(__dirname, 'fixtures', 'shebang2.js') });
		});

		it('should load js file with shebang and exported config', () => {
			const config = new Config({ configFile: path.join(__dirname, 'fixtures', 'shebang-export.js') });
			expect(config.get('foo')).to.equal('bar');
		});

		it('should not error loading an empty config file', () => {
			new Config({ configFile: path.join(__dirname, 'fixtures', 'empty.js') });
		});
	});

	describe('get()', () => {
		it('should get a value with a dynamic variable', () => {
			const config = new Config({
				config: {
					foo: 'Hello',
					bar: '{{foo}} world!'
				}
			});
			expect(config.get('bar')).to.equal('Hello world!');
		});

		it('should error getting a value with an undefined dynamic variable', () => {
			const config = new Config({
				config: {
					bar: '{{foo}} world!'
				}
			});
			expect(() => {
				config.get('bar');
			}).to.throw(Error, 'Config key "bar" references undefined variable "foo"');
		});

		it('should get a value with a deeply nested dynamic variable', () => {
			const config = new Config({
				config: {
					foo: 'Hello',
					bar: '{{foo}} world!',
					baz: 'Howdy! {{bar}} Hi!'
				}
			});
			expect(config.get('baz')).to.equal('Howdy! Hello world! Hi!');
		});

		it('should get a value with multiple dynamic variable', () => {
			const config = new Config({
				config: {
					a: 'A',
					b: 'B',
					c: 'C',
					d: 'D',
					e: 'E',
					foo: 'A={{a}} B={{b}} C={{c}} D={{d}} E={{e}}'
				}
			});
			expect(config.get('foo')).to.equal('A=A B=B C=C D=D E=E');
		});

		it('should resolve dynamic variable values within deep objects', () => {
			const config = new Config({
				config: {
					a: {
						b: {
							c: 'C {{d.e}}'
						}
					},
					d: {
						e: 'E'
					}
				}
			});

			expect(config.get('a')).to.deep.equal({
				b: {
					c: 'C E'
				}
			});
		});
	});

	describe('has()', () => {
		it('should error if key is not a valid string', () => {
			const config = new Config();

			expect(() => {
				config.has();
			}).to.throw(TypeError, 'Expected key to be a string');

			expect(() => {
				config.has(123);
			}).to.throw(TypeError, 'Expected key to be a string');
		});

		it('should check if a value is set', () => {
			const config = new Config({
				baseConfig: {
					a: 'A'
				},
				config: {
					b: {
						c: 'C'
					},
					e: true
				}
			});

			expect(config.has('a')).to.be.true;
			expect(config.has('b')).to.be.true;
			expect(config.has('b.c')).to.be.true;
			expect(config.has('b.d')).to.be.false;
			expect(config.has('e.f.g')).to.be.false;
			expect(config.has('i')).to.be.false;
			config.set('i', 'I');
			expect(config.has('i')).to.be.true;
		});
	});

	describe('load()', () => {
		it('should error if file is invalid', () => {
			const config = new Config();

			expect(() => {
				config.load();
			}).to.throw(TypeError, 'Expected config file to be a string');

			expect(() => {
				config.load(123);
			}).to.throw(TypeError, 'Expected config file to be a string');
		});

		it('should return if file to load is falsey and skipping non-existent', () => {
			const config = new Config();
			expect(config.load(null, { skipIfNotExists: true })).to.equal(config);
		});

		it('should error if file does not have .js or .json extension', () => {
			const config = new Config();
			expect(() => {
				config.load(path.join(__dirname, 'does_not_exist'));
			}).to.throw(Error, 'Config file must be a JavaScript or JSON file');
		});

		it('should error if file does not exist', () => {
			const config = new Config();
			const file = path.join(__dirname, 'does_not_exist.json');
			expect(() => {
				config.load(file);
			}).to.throw(Error, `Config file not found: ${file}`);
		});

		it('should not error if file does not exist and skipping non-existent', () => {
			const config = new Config();
			const file = path.join(__dirname, 'does_not_exist.json');
			expect(config.load(file, { skipIfNotExists: true })).to.equal(config);
		});

		it('should unload namespace if loading again', () => {
			const config = new Config();
			config.load(path.join(__dirname, 'fixtures', 'good.json'), { namespace: 'good' });
			expect(config.toString(0)).to.equal('{"[base]":{},"good":{"good":{"name":"foo","age":21,"food":["pizza","tacos"]}},"[user]":{},"[runtime]":{}}');

			config.load(path.join(__dirname, 'fixtures', 'good2.json'), { namespace: 'good' });
			expect(config.toString(0)).to.equal('{"[base]":{},"good":{"good":{"name":"bar","age":32,"food":["nachos"]}},"[user]":{},"[runtime]":{}}');
		});
	});

	describe('unload()', () => {
		it('should error if unloading base namespace', () => {
			const config = new Config();
			expect(() => {
				config.unload(Config.Base);
			}).to.throw(Error, 'Not allowed to unload base namespace');
		});

		it('should error if unloading user namespace', () => {
			const config = new Config();
			expect(() => {
				config.unload(Config.User);
			}).to.throw(Error, 'Not allowed to unload user namespace');
		});

		it('should error if unloading runtime namespace', () => {
			const config = new Config();
			expect(() => {
				config.unload(Config.Runtime);
			}).to.throw(Error, 'Not allowed to unload runtime namespace');
		});

		it('should error if namespace is invalid', () => {
			const config = new Config();

			expect(() => {
				config.unload();
			}).to.throw(TypeError, 'Expected namespace to be a string');

			expect(() => {
				config.unload(123);
			}).to.throw(TypeError, 'Expected namespace to be a string');
		});

		it('should return false if namespace is not found', () => {
			const config = new Config();
			expect(config.unload('foo')).to.equal(false);
		});

		it('should unload a namespace', () => {
			const config = new Config();
			config.load(path.join(__dirname, 'fixtures', 'good.json'), { namespace: 'good' });
			expect(config.toString(0)).to.equal('{"[base]":{},"good":{"good":{"name":"foo","age":21,"food":["pizza","tacos"]}},"[user]":{},"[runtime]":{}}');
			expect(config.unload('good')).to.equal(true);
		});
	});

	describe('parseJS()', () => {
		it('should error if code is not a string', () => {
			expect(() => {
				const config = new Config();
				config.parseJS();
			}).to.throw(TypeError, 'Expected code to be a string');

			expect(() => {
				const config = new Config();
				config.parseJS(123);
			}).to.throw(TypeError, 'Expected code to be a string');
		});

		it('should strip shebang when using unix line endings', () => {
			const config = new Config();
			config.parseJS('#!/foo/bar\rmodule.exports={};');
		});

		it('should strip shebang when using windows line endings', () => {
			const config = new Config();
			config.parseJS('#!/foo/bar\nmodule.exports={};');
		});
	});

	describe('push()', () => {
		it('should error when not given a key', () => {
			const config = new Config();
			expect(() => {
				config.push(123);
			}).to.throw(TypeError, 'Expected key to be a string');

			expect(() => {
				config.push();
			}).to.throw(TypeError, 'Expected key to be a string');

			expect(() => {
				config.push([]);
			}).to.throw(TypeError, 'Expected key to be a string');
		});

		it('should create an array if pre-existing value is not an array', () => {
			const config = new Config();
			config.set('foo', 'bar');
			expect(config.get('foo')).to.equal('bar');
			config.push('foo', 'baz');
			expect(config.get('foo')).to.deep.equal([ 'bar', 'baz' ]);
		});

		it('should create an array if pre-existing value is undefined', () => {
			const config = new Config();
			expect(config.get('foo.bar')).to.equal(undefined);
			config.push('foo.bar', 'baz');
			expect(config.get('foo.bar')).to.deep.equal([ 'baz' ]);
		});

		it('should push onto an existing array', () => {
			const config = new Config({ config: { foo: { bar: [ 'baz' ] } } });
			config.push('foo.bar', 'wiz');
			expect(config.get('foo.bar')).to.deep.equal([ 'baz', 'wiz' ]);
		});

		it('should not push a duplicate', () => {
			const config = new Config({ config: { foo: [ 'bar' ] } });
			config.push('foo', 'bar');
			expect(config.get('foo')).to.deep.equal([ 'bar' ]);
			config.push('foo', [ 'bar', 'baz' ]);
			expect(config.get('foo')).to.deep.equal([ 'bar', 'baz' ]);
		});

		it('should push overwrite an existing falsey value', () => {
			const config = new Config({ config: { foo: { bar: null } } });
			config.push('foo.bar', 'baz');
			expect(config.get('foo.bar')).to.deep.equal([ 'baz' ]);
		});

		it('should combine multiple types ', () => {
			const config = new Config({ config: { foo: { bar: [ 'baz' ] } } });
			config.push('foo', 'wiz');
			expect(config.get('foo')).to.deep.equal([ { bar: [ 'baz' ] }, 'wiz' ]);
		});

		it('should restrict to allowed types', () => {
			const config = new Config({ configFile: path.join(__dirname, 'fixtures', 'good-meta-simple.js') });
			expect(() => {
				config.push('arrays.arrayNums', 'foo');
			}).to.throw(Error, 'Invalid "arrays.arrayNums" value "foo"');
			config.push('arrays.arrayNums', 5);
			expect(config.get('arrays.arrayNums')).to.deep.equal([  1, 2, 3, 5 ]);
		});

		it('should be able to push onto multi types arrays', () => {
			const config = new Config({ configFile: path.join(__dirname, 'fixtures', 'good-meta-simple.js') });
			config.push('arrays.multi', 'foo');

			expect(config.get('arrays.multi')).to.deep.equal([ 'a', 1, 'foo' ]);
			expect(() => {
				config.push('arrays.multi', { me: 'fail' });
			}).to.throw(Error, 'Invalid "arrays.multi" value "[object Object]"');

			expect(() => {
				config.push('arrays.multi', true);
			}).to.throw(Error, 'Invalid "arrays.multi" value "true"');
		});

		it('should push to user-defined value loaded from file', () => {
			const config = new Config();
			config.load(path.join(__dirname, 'fixtures', 'good2.json'));
			config.push('name', 'baz');
			expect(config.get('name')).to.deep.equal([ 'bar', 'baz' ]);
			expect(config.toString(0)).to.equal('{"[base]":{},"[user]":{"age":32,"food":["nachos"],"name":["bar","baz"]},"[runtime]":{"age":32,"food":["nachos"],"name":["bar","baz"]}}');
		});

		it('should push to user-defined array loaded from file', () => {
			const config = new Config();
			config.load(path.join(__dirname, 'fixtures', 'good2.json'));
			config.push('food', 'breadsticks');
			expect(config.get('food')).to.deep.equal([ 'nachos', 'breadsticks' ]);
		});
	});

	describe('unshift()', () => {
		it('should error when not given a key', () => {
			const config = new Config();
			expect(() => {
				config.unshift(123);
			}).to.throw(TypeError, 'Expected key to be a string');

			expect(() => {
				config.unshift();
			}).to.throw(TypeError, 'Expected key to be a string');

			expect(() => {
				config.unshift([]);
			}).to.throw(TypeError, 'Expected key to be a string');
		});

		it('should create an array if pre-existing value is not an array', () => {
			const config = new Config();
			config.set('foo', 'bar');
			expect(config.get('foo')).to.equal('bar');
			config.unshift('foo', 'baz');
			expect(config.get('foo')).to.deep.equal([ 'baz', 'bar' ]);
		});

		it('should create an array if pre-existing value is undefined', () => {
			const config = new Config();
			config.set('foo', undefined);
			expect(config.get('foo')).to.equal(undefined);
			config.unshift('foo', 'baz');
			expect(config.get('foo')).to.deep.equal([ 'baz' ]);
		});

		it('should unshift onto an existing array', () => {
			const config = new Config({ config: { foo: { bar: [ 'baz' ] } } });
			config.unshift('foo.bar', 'wiz');
			expect(config.get('foo.bar')).to.deep.equal([ 'wiz', 'baz' ]);
		});

		it('should not unshift a duplicate', () => {
			const config = new Config({ config: { foo: [ 'bar' ] } });
			config.unshift('foo', 'bar');
			expect(config.get('foo')).to.deep.equal([ 'bar' ]);
			config.unshift('foo', [ 'bar', 'baz' ]);
			expect(config.get('foo')).to.deep.equal([ 'baz', 'bar' ]);
			config.unshift('foo', [ 'bar', 'foo', 'baz', 'wiz' ]);
			expect(config.get('foo')).to.deep.equal([ 'foo', 'wiz', 'baz', 'bar' ]);
		});

		it('should support adding multiple values', () => {
			const config = new Config();
			config.set('foo', 'bar');
			expect(config.get('foo')).to.equal('bar');
			config.unshift('foo', [ 'baz', 'wiz' ]);
			expect(config.get('foo')).to.deep.equal([ 'baz', 'wiz', 'bar' ]);
		});
	});

	describe('shift()', () => {
		it('should error when not given a key', () => {
			const config = new Config();
			expect(() => {
				config.shift(123);
			}).to.throw(TypeError, 'Expected key to be a string');

			expect(() => {
				config.shift();
			}).to.throw(TypeError, 'Expected key to be a string');

			expect(() => {
				config.shift([]);
			}).to.throw(TypeError, 'Expected key to be a string');
		});

		it('should return and remove first value of an array', () => {
			const config = new Config({ config: { foo: { bar: [ 'baz', 'wiz' ] } } });
			expect(config.shift('foo.bar')).to.equal('baz');
			expect(config.get('foo.bar')).to.deep.equal([ 'wiz' ]);
		});

		it('should return ', () => {
			const config = new Config({ config: { foo: { bar: [ 'baz' ] } } });
			expect(config.shift('foo.bar')).to.equal('baz');
			expect(config.get('foo.bar')).to.deep.equal([ ]);
		});

		it('should return undefined if no values in array', () => {
			const config = new Config({ config: { foo: { bar: [ ] } } });
			expect(config.shift('foo.bar')).to.equal(undefined);
		});

		it('should error if value is not an array', () => {
			const config = new Config({ config: { foo: { bar: 'baz' } } });
			expect(() => {
				config.shift('foo.bar');
			}).to.throw(TypeError, 'Configuration setting "foo.bar" is not an array');
		});
	});

	describe('pop()', () => {
		it('should error when not given a key', () => {
			const config = new Config();
			expect(() => {
				config.pop(123);
			}).to.throw(TypeError, 'Expected key to be a string');

			expect(() => {
				config.pop();
			}).to.throw(TypeError, 'Expected key to be a string');

			expect(() => {
				config.pop([]);
			}).to.throw(TypeError, 'Expected key to be a string');
		});

		it('should return and remove first value of an array', () => {
			const config = new Config({ config: { foo: { bar: [ 'baz', 'wiz' ] } } });
			expect(config.pop('foo.bar')).to.equal('wiz');
			expect(config.get('foo.bar')).to.deep.equal([ 'baz' ]);
		});

		it('should return ', () => {
			const config = new Config({ config: { foo: { bar: [ 'baz' ] } } });
			expect(config.pop('foo.bar')).to.equal('baz');
			expect(config.get('foo.bar')).to.deep.equal([ ]);
		});

		it('should return undefined if no values in array', () => {
			const config = new Config({ config: { foo: { bar: [ ] } } });
			expect(config.pop('foo.bar')).to.equal(undefined);
		});

		it('should error if value is not an array', () => {
			const config = new Config({ config: { foo: { bar: 'baz' } } });
			expect(() => {
				config.pop('foo.bar');
			}).to.throw(TypeError, 'Configuration setting "foo.bar" is not an array');
		});
	});

	describe('set()/get()', () => {
		it('should set/get a shallow property', () => {
			const config = new Config();
			config.set('foo', 'bar');
			expect(config.get('foo')).to.equal('bar');
			expect(config.toString(0)).to.equal('{"[base]":{},"[user]":{"foo":"bar"},"[runtime]":{"foo":"bar"}}');
		});

		it('should set/get a deep property', () => {
			const config = new Config();
			config.set('hello.world', 'foo');
			expect(config.get('hello')).to.deep.equal({ world: 'foo' });
			expect(config.get('hello.world')).to.equal('foo');
			expect(config.toString(0)).to.equal('{"[base]":{},"[user]":{"hello":{"world":"foo"}},"[runtime]":{"hello":{"world":"foo"}}}');
		});

		it('should error if key is not a string', () => {
			const config = new Config();

			expect(() => {
				config.get(123);
			}).to.throw(TypeError, 'Expected key to be a string');

			expect(() => {
				config.set();
			}).to.throw(TypeError, 'Expected key to be a string');

			expect(() => {
				config.set(123);
			}).to.throw(TypeError, 'Expected key to be a string');

			expect(() => {
				config.set([]);
			}).to.throw(TypeError, 'Expected key to be a string');
		});

		it('should return default value for unknown key', () => {
			const config = new Config();
			expect(config.get('foo', 'bar')).to.equal('bar');
			expect(config.get('foo.bar', 'baz')).to.equal('baz');
			config.set('foo', 123);
			expect(config.get('foo.bar', 'baz')).to.equal('baz');
		});

		it('should merge an object', () => {
			const config = new Config();
			config.set({ foo: 'bar' });
			expect(config.get('foo')).to.equal('bar');
		});

		it('should override existing', () => {
			const config = new Config({ config: { foo: { bar: [ 'baz' ] } } });
			config.set('foo.bar', 'wiz');
			expect(config.get('foo.bar')).to.equal('wiz');
		});

		it('should error if trying to set read-only property', () => {
			const config = new Config();
			config.set('foo', 'bar');
			expect(config.values).to.deep.equal({ foo: 'bar' });
			config.meta.set('foo', { readonly: true });

			expect(() => {
				config.set('foo', 'baz');
			}).to.throw(Error, 'Not allowed to set read-only property');

			expect(config.values).to.deep.equal({ foo: 'bar' });
		});

		it('should error if trying to set object with nested read-only property', () => {
			const config = new Config();
			config.set('foo', { bar: 'baz' });
			expect(config.values).to.deep.equal({ foo: { bar: 'baz' } });
			config.meta.set('foo.bar', { readonly: true });

			expect(() => {
				config.set('foo', 'wiz');
			}).to.throw(Error, 'Not allowed to set property with nested read-only property');

			expect(config.values).to.deep.equal({ foo: { bar: 'baz' } });
		});
	});

	describe('delete()', () => {
		it('should delete shallow property', () => {
			const config = new Config();
			config.set('foo', 'bar');
			config.delete('foo');
			expect(config.get('foo')).to.be.undefined;
			expect(config.toString(0)).to.equal('{"[base]":{},"[user]":{},"[runtime]":{}}');
		});

		it('should delete deep property', () => {
			const config = new Config();
			config.set('foo.bar', 'baz');
			config.delete('foo');
			expect(config.get('foo')).to.be.undefined;
			expect(config.toString(0)).to.equal('{"[base]":{},"[user]":{},"[runtime]":{}}');

			config.set('foo.bar', 'baz');
			config.delete('foo.bar');
			expect(config.get('foo')).to.be.undefined;
			expect(config.toString(0)).to.equal('{"[base]":{},"[user]":{},"[runtime]":{}}');
		});

		it('should return false if deleting non-existent key', () => {
			const config = new Config();
			expect(config.delete('foo')).to.be.false;
		});

		it('should error if calling delete without a key', () => {
			const config = new Config();

			expect(() => {
				config.delete();
			}).to.throw(Error, 'Expected key to be a string');

			expect(() => {
				config.delete('');
			}).to.throw(Error, 'Expected key to be a string');

			expect(() => {
				config.delete(null);
			}).to.throw(Error, 'Expected key to be a string');
		});

		it('should error if trying to delete read-only property', () => {
			const config = new Config();
			config.set('foo', 'bar');
			expect(config.values).to.deep.equal({ foo: 'bar' });
			config.meta.set('foo', { readonly: true });

			expect(() => {
				config.delete('foo');
			}).to.throw(Error, 'Not allowed to delete read-only property');

			expect(config.values).to.deep.equal({ foo: 'bar' });
		});

		it('should error if trying to delete object with nested read-only property', () => {
			const config = new Config();
			config.set('foo', { bar: 'baz' });
			expect(config.values).to.deep.equal({ foo: { bar: 'baz' } });
			config.meta.set('foo.bar', { readonly: true });

			expect(() => {
				config.delete('foo');
			}).to.throw(Error, 'Not allowed to delete property with nested read-only property');

			expect(config.values).to.deep.equal({ foo: { bar: 'baz' } });
		});
	});

	describe('merge()', () => {
		it('should return immediately if source is not an object', () => {
			const config = new Config();
			expect(config.merge()).to.equal(config);
			expect(config.toString(0)).to.equal('{"[base]":{},"[user]":{},"[runtime]":{}}');
		});

		it('should append arrays', () => {
			const config = new Config();
			config.set('foo', [ 'bar' ]);
			config.merge({ foo: [ 'baz' ] });
			expect(config.get('foo')).to.deep.equal([ 'bar', 'baz' ]);
		});

		it('should not merge duplicate array elements', () => {
			const config = new Config();
			config.set('foo', [ 'bar' ]);
			config.merge({ foo: [ 'baz', 'bar' ] });
			expect(config.get('foo')).to.deep.equal([ 'bar', 'baz' ]);
			config.merge({ foo: [ 'wiz', 'bar', 'fiz' ] });
			expect(config.get('foo')).to.deep.equal([ 'bar', 'baz', 'wiz', 'fiz' ]);
		});

		it('should mix deep objects', () => {
			const config = new Config();
			config.set('foo', { bar: 'baz' });
			config.merge({ foo: { wiz: 'pow' } });
			expect(config.toString(0)).to.equal('{"[base]":{},"[user]":{"foo":{"bar":"baz","wiz":"pow"}},"[runtime]":{"foo":{"bar":"baz","wiz":"pow"}}}');
		});
	});

	describe('save()', () => {
		it('should get user settings only', () => {
			const config = new Config({
				config: {
					foo: 'bar',
					baz: {
						wiz: 'pow'
					},
					boo: []
				}
			});

			config.set('name', 'yip');
			config.set('alpha.omega', 'gamma');
			config.set('r.g.b', 'mk');
			config.delete('r.g');
			config.push('foo', 'zap');
			config.set({
				arr: [ 1, 2, 3 ],
				obj: {
					a: 'b'
				}
			});

			expect(config.getUserConfig()).to.deep.equal({
				alpha: {
					omega: 'gamma'
				},
				foo: [ 'bar', 'zap' ],
				name: 'yip',
				arr: [ 1, 2, 3 ],
				obj: {
					a: 'b'
				}
			});
		});

		it('should save the user config settings to a file', async () => {
			const dir = makeTempDir();
			const inFile = path.join(dir, 'input.json');
			const outFile = path.join(dir, 'output.json');

			const config = new Config({
				config: {
					foo: 'bar',
					baz: {
						wiz: 'pow'
					}
				}
			});

			const values = {
				alpha: 'beta',
				baz: {
					wow: 'zip',
					wiz: 'wee'
				},
				arr: [ 1, 2, 3 ]
			};

			fs.writeFileSync(inFile, JSON.stringify(values, null, 4));

			config.load(inFile);

			await config.save(outFile);

			expect(JSON.parse(fs.readFileSync(outFile))).to.deep.equal(values);
			expect(config.toString(0)).to.equal('{"[base]":{},"[user]":{"alpha":"beta","baz":{"wow":"zip","wiz":"wee"},"arr":[1,2,3]},"[runtime]":{"foo":"bar","alpha":"beta","baz":{"wow":"zip","wiz":"wee"},"arr":[1,2,3]}}');
		});
	});

	describe('watch/unwatch', () => {
		it('should watch and unwatch changes', () => {
			const config = new Config();
			let count = 0;
			const callback = () => {
				count++;
			};

			config.set('foo', 'bar1');
			expect(count).to.equal(0);

			config.watch(callback);

			config.set('foo', 'bar2');
			expect(count).to.equal(1);

			config.set('foo', 'bar3');
			expect(count).to.equal(2);

			config.unwatch(callback);

			config.set('foo', 'bar4');
			expect(count).to.equal(2);

			config.set('foo', 'bar5');
			expect(count).to.equal(2);
		});
	});

	describe('metadata', () => {
		it('should load js config file with metadata', () => {
			const config = new Config({ configFile: path.join(__dirname, 'fixtures', 'good-meta.js') });
			expect(config.toString(0)).to.equal('{"[base]":{},"[user]":{},"[runtime]":{"name":"foo","age":21,"id":"123456","arrays":{"simple":["pizza","tacos"],"arrayNums":[1,2,3],"arrayNums2":[4,5,6],"arrayNums3":[7,8,9],"multi":["a",1],"multiUnknown":["a"]},"multi":null,"couldBeNull":null,"couldBeNull2":null,"cantBeNull":0,"obsolete":true,"job":{"title":"coder"},"foo":"bar"}}');

			validateMetadata(config.meta.get('name'), 'Everybody has a name.', 'String', false, false);
			validateMetadata(config.meta.get('age'), 'How old are you?', 'Number', 'Age ain\'t nothing but a number', false);
			validateMetadata(config.meta.get('id'), 'A unique id.', 'String', false, true);
			validateMetadata(config.meta.get('arrays.simple'), 'A simple array with no datatype.', 'Array', false, false);
			validateMetadata(config.meta.get('arrays.arrayNums'), 'Array of numbers', 'Array.<Number>', false, false);
			validateMetadata(config.meta.get('arrays.arrayNums2'), 'Another array of numbers.', 'Array.<Number>', false, false);
			validateMetadata(config.meta.get('arrays.arrayNums3'), 'Yet another array of numbers.', 'Array.<Number>', false, false);
			validateMetadata(config.meta.get('arrays.multi'), 'Array of numbers or strings.', 'Array.<(number|string)>', false, false);
			validateMetadata(config.meta.get('arrays.multiUnknown'), 'Array of multiple unknown types.', 'Array.<(foo|bar)>', false, false);
			validateMetadata(config.meta.get('multi'), 'Multiple types.', '(number|string)', false, false);
			validateMetadata(config.meta.get('couldBeNull'), 'Could be null.', '?number', false, false);
			validateMetadata(config.meta.get('couldBeNull2'), 'Could be null.', '(number|null)', false, false);
			validateMetadata(config.meta.get('cantBeNull'), 'Cannot be null.', '!number', false, false);
			validateMetadata(config.meta.get('couldBeUndef'), 'Could be undefined.', '(number|undefined)', false, false);
			validateMetadata(config.meta.get('obsolete'), '', null, true, false);
			validateMetadata(config.meta.get('job.title'), 'Job title.', 'String', false, false);
		});

		it('should load simple js config file with metadata', () => {
			const config = new Config({ configFile: path.join(__dirname, 'fixtures', 'good-meta-simple.js') });
			expect(config.toString(0)).to.equal('{"[base]":{},"[user]":{},"[runtime]":{"name":"foo","age":21,"id":"123456","arrays":{"simple":["pizza","tacos"],"arrayNums":[1,2,3],"arrayNums2":[4,5,6],"arrayNums3":[7,8,9],"multi":["a",1]},"multi":null,"couldBeNull":null,"couldBeNull2":null,"cantBeNull":0,"job":{"title":"coder"},"noDesc":"nada"}}');

			validateMetadata(config.meta.get('name'), 'Everybody has a name.', 'String', false, false);
			validateMetadata(config.meta.get('age'), 'How old are you?', 'Number', 'Age ain\'t nothing but a number', false);
			validateMetadata(config.meta.get('id'), 'A unique id.', 'String', false, true);
			validateMetadata(config.meta.get('arrays.simple'), 'A simple array with no datatype.', 'Array', false, false);
			validateMetadata(config.meta.get('arrays.arrayNums'), 'Array of numbers', 'Array.<Number>', false, false);
			validateMetadata(config.meta.get('arrays.arrayNums2'), 'Another array of numbers.', 'Array.<Number>', false, false);
			validateMetadata(config.meta.get('arrays.arrayNums3'), 'Yet another array of numbers.', 'Array.<Number>', false, false);
			validateMetadata(config.meta.get('arrays.multi'), 'Array of numbers or strings.', 'Array.<(number|string)>', false, false);
			validateMetadata(config.meta.get('multi'), 'Multiple types.', '(number|string)', false, false);
			validateMetadata(config.meta.get('couldBeNull'), 'Could be null.', '?number', false, false);
			validateMetadata(config.meta.get('couldBeNull2'), 'Could be null.', '(number|null)', false, false);
			validateMetadata(config.meta.get('cantBeNull'), 'Cannot be null.', '!number', false, false);
			validateMetadata(config.meta.get('couldBeUndef'), 'Could be undefined.', '(number|undefined)', false, false);
			validateMetadata(config.meta.get('job.title'), 'Job title.', 'String', false, false);
			validateMetadata(config.meta.get('noDesc'), '', 'String', false, false);
		});

		it('should load as much metadata as understood', () => {
			// the AST walking code can't handle crazy stuff
			const code = `
			function foo() {
				return {
					/**
					 * Too bad we won't see this.
					 * @type {string|null}
					 */
					'leftout': null
				};
			}

			module.exports = {
				/**
				 * Some setting
				 * @type {String}
				 */
				someSetting: null,

				boo: foo(),

				/**
				 * Some other setting
				 * @type {String}
				 */
				otherSetting: null
			};
			`;

			const config = new Config();
			config.parseJS(code);
			expect(Array.from(config.meta._map.keys())).to.deep.equal([ 'someSetting', 'otherSetting' ]);
		});

		it('should enforce datatypes', () => {
			const config = new Config({ configFile: path.join(__dirname, 'fixtures', 'good-meta.js') });
			expect(() => {
				config.set('id', 'foo');
			}).to.throw(Error, 'Not allowed to set read-only property');
		});
	});
});

function validateMetadata(meta, desc, type, deprecated, readonly) {
	expect(meta).to.be.an('object');
	expect(meta).to.have.property('desc', desc);
	expect(meta).to.have.property('type', type);
	expect(meta).to.have.property('deprecated', deprecated);
	expect(meta).to.have.property('readonly', readonly);
	expect(meta).to.have.property('validate');
	expect(meta.validate).to.be.a('function');
}
