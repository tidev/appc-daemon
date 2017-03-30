import Config from '../src/index';
import path from 'path';

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
	it('should work!', () => {
		//
	});
});

describe('Config', () => {
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
				new Config({ configFile: function(){} });
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
			const config = new Config({ configFile: path.join(__dirname, 'fixtures', 'shebang.js') });
			const config2 = new Config({ configFile: path.join(__dirname, 'fixtures', 'shebang2.js') });
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
			const config = new Config({ config: { foo: { bar: ['baz'] } } });
			config.set('foo.bar', 'wiz');
			expect(config.get('foo.bar')).to.equal('wiz');
		});

		it('should emit an event when setting', () => {
			const config = new Config();
			let fired = false;
			config.on('change', () => {
				fired = true;
			});
			config.set('foo', 'bar');
			expect(fired).to.be.true;
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
	});

	describe('merge()', () => {
		it('should return immediately if source is not an object', () => {
			const config = new Config();
			expect(config.merge()).to.equal(config);
			expect(config.toString(0)).to.equal('{}');
		});

		it('should append arrays', () => {
			const config = new Config();
			config.set('foo', ['bar']);
			config.merge({ foo: ['baz'] });
			expect(config.get('foo')).to.deep.equal(['bar', 'baz']);
		});

		it('should mix deep objects', () => {
			const config = new Config();
			config.set('foo', { bar: 'baz' });
			config.merge({ foo: { wiz: 'pow' } });
			expect(config.toString(0)).to.equal('{"foo":{"bar":"baz","wiz":"pow"}}');
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
			expect(Array.from(config.meta._map.keys())).to.deep.equal(['someSetting', 'otherSetting']);
		});

		it('should enforce datatypes', () => {
			const config = new Config({ configFile: path.join(__dirname, 'fixtures', 'good-meta.js') });
			expect(() => {
				config.set('id', 'foo');
			}).to.throw(Error, 'Config option "id" is readonly');
		});
	});
});

function validateMetadata(meta, desc, type, deprecated, readonly) {
	expect(meta).to.be.an.object;
	expect(meta).to.have.property('desc', desc);
	expect(meta).to.have.property('type', type);
	expect(meta).to.have.property('deprecated', deprecated);
	expect(meta).to.have.property('readonly', readonly);
	expect(meta).to.have.property('validate');
	expect(meta.validate).to.be.a.function;
}
