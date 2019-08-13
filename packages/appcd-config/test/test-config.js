import Config, { load } from '../dist/index';
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

describe('load()', () => {
	/**
	 * Creates a `Config` instance and loads the specified configuration and
	 * environment specific configuration files.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {Object} [opts.config] - An object with various config settings. The
	 * config object will be initialized with these values, however if any user-
	 * defined or environment specific config files are loaded, then this object
	 * will be re-merged since it always takes precedence.
	 * @param {String} [opts.configFile] - Path to a config file to load. It may be
	 * a JavaScript or JSON file.
	 * @returns {Config}
	export function load({ config, configFile, defaultConfigFile } = {}) {
	*/
	it('should load without any options', () => {
		const config = load();
		expect(config).to.be.instanceof(Config);
		expect(config.toString(0)).to.equal('{}');

		const config2 = load({});
		expect(config2).to.be.instanceof(Config);
		expect(config2.toString(0)).to.equal('{}');
	});

	it('should fail if config option is invalid', () => {
		expect(() => {
			load({ config: 'foo' });
		}).to.throw(TypeError, 'Expected config to be an object');

		expect(() => {
			load({ config: [] });
		}).to.throw(TypeError, 'Expected config to be an object');
	});

	it('should fail if default config file option is invalid', () => {
		expect(() => {
			load({ defaultConfigFile: 123 });
		}).to.throw(TypeError, 'Expected config file to be a string');

		expect(() => {
			load({ defaultConfigFile: path.join(__dirname, 'noextension') });
		}).to.throw(Error, 'Config file must be a JavaScript or JSON file');

		const doesnotexist = path.join(__dirname, 'doesnotexist.js');
		expect(function () {
			load({ defaultConfigFile: doesnotexist });
		}).to.throw(Error, `Config file not found: ${doesnotexist}`);
	});

	it('should fail if config file option is invalid', () => {
		expect(() => {
			load({ configFile: 123 });
		}).to.throw(TypeError, 'Expected config file to be a string');

		expect(() => {
			load({ configFile: path.join(__dirname, 'noextension') });
		}).to.throw(Error, 'Config file must be a JavaScript or JSON file');

		const doesnotexist = path.join(__dirname, 'doesnotexist.js');
		expect(function () {
			load({ configFile: doesnotexist });
		}).to.throw(Error, `Config file not found: ${doesnotexist}`);
	});

	it('should load a config and default config file', () => {
		const config = load({
			configFile: path.join(__dirname, 'fixtures', 'good-load.js'),
			defaultConfigFile: path.join(__dirname, 'fixtures', 'good-default-load.js')
		});
		expect(config.toString(0)).to.equal('{"food":["pizza","tacos"],"name":"foo","age":30}');
	});

	it('should load environment specific config file', () =>  {
		const config = load({
			configFile: path.join(__dirname, 'fixtures', 'good-load-foo.js')
		});
		expect(config.toString(0)).to.equal('{"environment":{"name":"foo"},"name":"baz"}');
	});

	it('should merge custom config with config file', () => {
		const config = load({
			config: {
				age: 29,
				food: 'nachos'
			},
			configFile: path.join(__dirname, 'fixtures', 'good-load.js')
		});
		expect(config.toString(0)).to.equal('{"food":"nachos","name":"foo","age":29}');
	});
});

describe('Config', () => {
	after(() => {
		fs.removeSync(tmpDir);
	});

	describe('constructor', () => {
		it('should load blank config', () => {
			const config = new Config();
			expect(config).to.be.instanceof(Config);
			expect(config.toString()).to.equal('{}');
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

			const doesnotexist = path.join(__dirname, 'doesnotexist.js');
			expect(function () {
				new Config({ configFile: doesnotexist });
			}).to.throw(Error, `Config file not found: ${doesnotexist}`);

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
			expect(config.toString(0)).to.equal('{"name":"foo","age":21,"food":["pizza","tacos"]}');
		});

		it('should load js config file', () => {
			const config = new Config({ configFile: path.join(__dirname, 'fixtures', 'good.js') });
			expect(config.toString(0)).to.equal('{"name":"foo","age":21,"food":["pizza","tacos"]}');
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
			expect(config.toString(0)).to.equal('{"foo":"bar"}');
		});

		it('should set/get a deep property', () => {
			const config = new Config();
			config.set('hello.world', 'foo');
			expect(config.get('hello')).to.deep.equal({ world: 'foo' });
			expect(config.get('hello.world')).to.equal('foo');
			expect(config.toString(0)).to.equal('{"hello":{"world":"foo"}}');
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
			expect(config.toString(0)).to.equal('{}');
		});

		it('should delete deep property', () => {
			const config = new Config();
			config.set('foo.bar', 'baz');
			config.delete('foo');
			expect(config.get('foo')).to.be.undefined;
			expect(config.toString(0)).to.equal('{}');

			config.set('foo.bar', 'baz');
			config.delete('foo.bar');
			expect(config.get('foo')).to.be.undefined;
			expect(config.toString(0)).to.equal('{}');
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
			expect(config.toString(0)).to.equal('{}');
		});

		it('should append arrays', () => {
			const config = new Config();
			config.set('foo', [ 'bar' ]);
			config.merge({ foo: [ 'baz' ] });
			expect(config.get('foo')).to.deep.equal([ 'bar', 'baz' ]);
		});

		it('should mix deep objects', () => {
			const config = new Config();
			config.set('foo', { bar: 'baz' });
			config.merge({ foo: { wiz: 'pow' } });
			expect(config.toString(0)).to.equal('{"foo":{"bar":"baz","wiz":"pow"}}');
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

			config.loadUserConfig(inFile);

			await config.save(outFile);

			expect(JSON.parse(fs.readFileSync(outFile))).to.deep.equal(values);
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
			expect(config.toString(0)).to.equal('{"name":"foo","age":21,"id":"123456","arrays":{"simple":["pizza","tacos"],"arrayNums":[1,2,3],"arrayNums2":[4,5,6],"arrayNums3":[7,8,9],"multi":["a",1],"multiUnknown":["a"]},"multi":null,"couldBeNull":null,"couldBeNull2":null,"cantBeNull":0,"obsolete":true,"job":{"title":"coder"},"foo":"bar"}');

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
			expect(config.toString(0)).to.equal('{"name":"foo","age":21,"id":"123456","arrays":{"simple":["pizza","tacos"],"arrayNums":[1,2,3],"arrayNums2":[4,5,6],"arrayNums3":[7,8,9],"multi":["a",1]},"multi":null,"couldBeNull":null,"couldBeNull2":null,"cantBeNull":0,"job":{"title":"coder"},"noDesc":"nada"}');

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
