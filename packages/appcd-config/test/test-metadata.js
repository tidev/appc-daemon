import Metadata from '../dist/metadata';
import path from 'path';

describe('Metadata', () => {

	describe('load()', () => {
		it('should load a metadata file', () => {
			const md = new Metadata();
			md.load(path.join(__dirname, 'fixtures', 'good.json.metadata'));
			expect(Array.from(md._map.keys())).to.deep.equal([
				'name',
				'age',
				'id',
				'arrays.simple',
				'arrays.arrayNums',
				'arrays.arrayNums2',
				'arrays.arrayNums3',
				'arrays.multi',
				'arrays.multiUnknown',
				'multi',
				'couldBeNull',
				'couldBeNull2',
				'couldBeNull3',
				'cantBeNull',
				'couldBeUndef',
				'job.title',
				'notype'
			]);
		});

		it('should not error if file doesn\'t exist', () => {
			new Metadata().load(path.join(__dirname, 'fixtures', 'doesnotexists.metadata'));
		});

		it('should error if file is not a valid string', () => {
			expect(() => {
				new Metadata().load();
			}).to.throw(TypeError, 'Expected file to be a string');

			expect(() => {
				new Metadata().load(123);
			}).to.throw(TypeError, 'Expected file to be a string');

			expect(() => {
				new Metadata().load('');
			}).to.throw(TypeError, 'Expected file to be a string');
		});

		it('should error if metadata file is not valid json', () => {
			expect(() => {
				new Metadata().load(path.join(__dirname, 'fixtures', 'bad-syntax.json.metadata'));
			}).to.throw(Error, /^Failed to load config metadata file: /);
		});

		it('should error if metadata file is not an object', () => {
			expect(() => {
				new Metadata().load(path.join(__dirname, 'fixtures', 'bad-string.json.metadata'));
			}).to.throw(Error, 'Failed to load config metadata file: expected an object');
		});

		it('should error if metadata file contains non-object entry', () => {
			expect(() => {
				new Metadata().load(path.join(__dirname, 'fixtures', 'bad-entry.json.metadata'));
			}).to.throw(Error, 'Failed to load config metadata file: invalid entry "hello"');
		});

		it('should not error if entry is an empty object', () => {
			const md = new Metadata();
			md.load(path.join(__dirname, 'fixtures', 'good-empty-object.json.metadata'));
			expect(md._map.has('name')).to.be.true;

			const meta = md.get('name');
			expect(meta).to.be.an('object');
			expect(meta).to.have.property('desc', '');
			expect(meta).to.have.property('type', null);
			expect(meta).to.have.property('deprecated', false);
			expect(meta).to.have.property('readonly', false);
			expect(meta).to.have.property('validate');
			expect(meta.validate).to.be.a('function');
		});

		it('should error if type is bad', () => {
			expect(() => {
				new Metadata().load(path.join(__dirname, 'fixtures', 'bad-type.json.metadata'));
			}).to.throw(Error, 'Failed to load config metadata file: invalid type "[object Object]" for entry "hello"');
		});

		it('should load metadata file with union type and array of union type', () => {
			const md = new Metadata();
			md.load(path.join(__dirname, 'fixtures', 'good-unknown.json.metadata'));
			expect(Array.from(md._map.keys())).to.deep.equal([ 'test1', 'test2' ]);
			expect(md.get('test1').type).to.equal('(bar|baz)');
			expect(md.get('test2').type).to.equal('Array.<(bar|baz)>');
		});
	});

	describe('parse()', () => {
		it('should throw error if ast is not an object', () => {
			expect(() => {
				new Metadata().parse();
			}).to.throw(TypeError, 'Expected ast to be an object');

			expect(() => {
				new Metadata().parse(123);
			}).to.throw(TypeError, 'Expected ast to be an object');

			expect(() => {
				new Metadata().parse([]);
			}).to.throw(TypeError, 'Expected ast to be an object');

			expect(() => {
				new Metadata().parse(null);
			}).to.throw(TypeError, 'Expected ast to be an object');
		});
	});

	describe('registerType()', () => {
		it('should add a custom type', () => {
			const md = new Metadata();
			md.registerType('Foo', it => true);
		});

		it('should error if type is not a string', () => {
			expect(() => {
				new Metadata().registerType();
			}).to.throw(TypeError, 'Expected type to be a string');

			expect(() => {
				new Metadata().registerType(123);
			}).to.throw(TypeError, 'Expected type to be a string');

			expect(() => {
				new Metadata().registerType('');
			}).to.throw(TypeError, 'Expected type to be a string');
		});

		it('should error if type is already registered', () => {
			expect(() => {
				const md = new Metadata();
				md.registerType('Foo', it => true);
				md.registerType('Foo', it => true);
			}).to.throw(Error, 'Type "foo" is already registered');

			expect(() => {
				const md = new Metadata();
				md.registerType('String', it => true);
			}).to.throw(Error, 'Type "string" is already registered');
		});

		it('should error if validate is not a function', () => {
			expect(() => {
				new Metadata().registerType('Foo');
			}).to.throw(TypeError, 'Expected validate to be a function');

			expect(() => {
				new Metadata().registerType('Foo', 123);
			}).to.throw(TypeError, 'Expected validate to be a function');
		});
	});

	describe('set()', () => {
		it('should set metadata for a key', () => {
			const md = new Metadata();
			md.set('foo', {});
			expect(md._map.has('foo')).to.be.true;
		});

		it('should set metadata with nullable and readonly', () => {
			const md = new Metadata();
			md.set('foo', {
				nullable: true,
				readonly: true
			});
			expect(md._map.has('foo')).to.be.true;
		});

		it('should set metadata for multiple unknown types', () => {
			const md = new Metadata();
			md.set('foo', {
				type: 'bar|baz'
			});
			expect(md._map.has('foo')).to.be.true;
			const meta = md.get('foo');
			expect(meta.type).to.equal('(bar|baz)');
		});

		it('should error if metadata for a key', () => {
			expect(() => {
				new Metadata().set();
			}).to.throw(TypeError, 'Expected key to be a string');

			expect(() => {
				new Metadata().set(123);
			}).to.throw(TypeError, 'Expected key to be a string');

			expect(() => {
				new Metadata().set('');
			}).to.throw(TypeError, 'Expected key to be a string');
		});

		it('should error if metadata is not an object', () => {
			expect(() => {
				new Metadata().set('foo', null);
			}).to.throw(TypeError, 'Expected metadata to be an object');

			expect(() => {
				new Metadata().set('foo', 123);
			}).to.throw(TypeError, 'Expected metadata to be an object');

			expect(() => {
				new Metadata().set('foo', []);
			}).to.throw(TypeError, 'Expected metadata to be an object');
		});
	});

	describe('get()', () => {
		it('should get metadata for key', () => {
			const md = new Metadata();
			md.load(path.join(__dirname, 'fixtures', 'good.json.metadata'));
			const meta = md.get('name');
			expect(meta).to.be.an('object');
		});

		it('should error if key is not a string', () => {
			expect(() => {
				new Metadata().get();
			}).to.throw(TypeError, 'Expected key to be a string');

			expect(() => {
				new Metadata().get(123);
			}).to.throw(TypeError, 'Expected key to be a string');

			expect(() => {
				new Metadata().get('');
			}).to.throw(TypeError, 'Expected key to be a string');
		});

		it('should return undefined for an unknown key', () => {
			expect(new Metadata().get('foo')).to.be.undefined;
		});
	});

	describe('has()', () => {
		it('should get metadata for key', () => {
			const md = new Metadata();
			md.set('name', {});
			expect(md.has('name')).to.be.true;
			expect(md.has('age')).to.be.false;
		});

		it('should error if key is not a string', () => {
			expect(() => {
				new Metadata().has();
			}).to.throw(TypeError, 'Expected key to be a string');

			expect(() => {
				new Metadata().has(123);
			}).to.throw(TypeError, 'Expected key to be a string');

			expect(() => {
				new Metadata().has('');
			}).to.throw(TypeError, 'Expected key to be a string');
		});
	});

	describe('delete()', () => {
		it('should remove metadata for key', () => {
			const md = new Metadata();
			expect(md.has('name')).to.be.false;
			md.set('name', {});
			expect(md.has('name')).to.be.true;
			md.delete('name');
			expect(md.has('name')).to.be.false;
		});

		it('should error if key is not a string', () => {
			expect(() => {
				new Metadata().delete();
			}).to.throw(TypeError, 'Expected key to be a string');

			expect(() => {
				new Metadata().delete(123);
			}).to.throw(TypeError, 'Expected key to be a string');

			expect(() => {
				new Metadata().delete('');
			}).to.throw(TypeError, 'Expected key to be a string');
		});
	});

	describe('validate()', () => {
		it('should validate a string config option', () => {
			const md = new Metadata();
			md.load(path.join(__dirname, 'fixtures', 'good.json.metadata'));
			expect(md.validate('name', 'hello')).to.be.true;
		});

		it('should error if key is not a string', () => {
			expect(() => {
				new Metadata().validate();
			}).to.throw(TypeError, 'Expected key to be a string');

			expect(() => {
				new Metadata().validate(123);
			}).to.throw(TypeError, 'Expected key to be a string');

			expect(() => {
				new Metadata().validate('');
			}).to.throw(TypeError, 'Expected key to be a string');
		});

		it('should error if trying to set a readonly setting', () => {
			expect(() => {
				const md = new Metadata();
				md.load(path.join(__dirname, 'fixtures', 'good.json.metadata'));
				expect(md.validate('id', 'hello')).to.be.false;
			}).to.throw(Error, 'Config option "id" is read-only');
		});

		it('should validate array of union type', () => {
			const md = new Metadata();
			md.load(path.join(__dirname, 'fixtures', 'good.json.metadata'));
			expect(md.validate('arrays.multi', [ 'hi', 123 ])).to.be.true;
			expect(() => {
				md.validate('arrays.multi', [ true ]);
			}).to.throw(Error, 'Invalid "arrays.multi" value "true"');
		});

		it('should validate a boolean', () => {
			const md = new Metadata();
			md.set('foo', {
				type: 'boolean'
			});
			expect(md.validate('foo', true)).to.be.true;
			expect(() => {
				md.validate('foo', 123);
			}).to.throw(Error, 'Invalid "foo" value "123"');
		});

		it('should validate a number', () => {
			const md = new Metadata();
			md.set('foo', {
				type: 'number'
			});
			expect(() => {
				md.validate('foo', 'bar');
			}).to.throw(Error, 'Invalid "foo" value "bar"');
			expect(md.validate('foo', 123)).to.be.true;
			expect(md.validate('foo', 3.14)).to.be.true;
			expect(md.validate('foo', NaN)).to.be.true;
		});

		it('should validate a string', () => {
			const md = new Metadata();
			md.set('foo', {
				type: '!string'
			});
			expect(md.validate('foo', 'bar')).to.be.true;
			expect(() => {
				md.validate('foo', 123);
			}).to.throw(Error, 'Invalid "foo" value "123"');
			expect(() => {
				md.validate('foo', null);
			}).to.throw(Error, 'Invalid "foo" value "null"');
		});

		it('should validate an object', () => {
			const md = new Metadata();
			md.set('foo', {
				type: '!object'
			});
			expect(md.validate('foo', {})).to.be.true;
			expect(() => {
				md.validate('foo', 'bar');
			}).to.throw(Error, 'Invalid "foo" value "bar"');
			expect(() => {
				md.validate('foo', 123);
			}).to.throw(Error, 'Invalid "foo" value "123"');
			expect(() => {
				md.validate('foo', null);
			}).to.throw(Error, 'Invalid "foo" value "null"');
		});

		it('should validate undefined', () => {
			const md = new Metadata();
			md.set('foo', {
				type: 'undefined'
			});
			expect(md.validate('foo', undefined)).to.be.true;
			expect(() => {
				md.validate('foo', 'bar');
			}).to.throw(Error, 'Invalid "foo" value "bar"');
			expect(() => {
				md.validate('foo', 123);
			}).to.throw(Error, 'Invalid "foo" value "123"');
		});

		it('should validate null', () => {
			const md = new Metadata();
			md.set('foo', {
				type: 'null'
			});
			expect(md.validate('foo', null)).to.be.true;
			expect(() => {
				md.validate('foo', {});
			}).to.throw(Error, 'Invalid "foo" value "[object Object]"');
			expect(() => {
				md.validate('foo', 'bar');
			}).to.throw(Error, 'Invalid "foo" value "bar"');
			expect(() => {
				md.validate('foo', 123);
			}).to.throw(Error, 'Invalid "foo" value "123"');
		});

		it('should validate a boolean cannot be overwritten', () => {
			const md = new Metadata();
			md.set('foo', {
				type: 'boolean'
			});
			expect(() => {
				expect(md.validate('foo.bar', 'baz')).to.be.true;
			}).to.throw(Error, 'Cannot overwrite boolean "foo" value with object');
		});

		it('should validate for unknown type', () => {
			const md = new Metadata();
			md.set('foo', {
				type: 'bar'
			});
			expect(md.validate('foo', 'baz')).to.be.true;
			expect(md.validate('foo', 123)).to.be.true;
			expect(md.validate('foo', null)).to.be.true;
		});

		it('should validate readonly setting', () => {
			const md = new Metadata();
			md.set('foo', {
				readonly: true
			});
			expect(() => {
				md.validate('foo', 'baz');
			}).to.throw(Error, 'Config option "foo" is read-only');
			expect(() => {
				md.validate('foo', 'baz', { overrideReadonly: true });
			}).to.not.throw;
		});

		it('should validate setting with no type loaded from metadata file', () => {
			const md = new Metadata();
			md.load(path.join(__dirname, 'fixtures', 'good.json.metadata'));
			expect(md.validate('notype', 'baz')).to.be.true;
		});
	});

});
