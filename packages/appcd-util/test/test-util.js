import path from 'path';

import * as util from '../src/util';

describe('util', () => {

	describe('arch()', () => {
		beforeEach(function () {
			this.PROCESSOR_ARCHITEW6432 = process.env.PROCESSOR_ARCHITEW6432;
		});

		afterEach(function () {
			delete process.env.APPCD_TEST_PLATFORM;
			delete process.env.APPCD_TEST_ARCH;
			this.PROCESSOR_ARCHITEW6432 && (process.env.PROCESSOR_ARCHITEW6432 = this.PROCESSOR_ARCHITEW6432);
		});

		it('should detect the system architecture', () => {
			const a = util.arch();
			expect(a).to.be.oneOf(['x86', 'x64']);
		});

		it('should cache the architecture', () => {
			process.env.APPCD_TEST_ARCH = 'x64';
			expect(util.arch(true)).to.equal('x64');

			process.env.APPCD_TEST_ARCH = 'ia32';
			expect(util.arch()).to.equal('x64');

			expect(util.arch(true)).to.equal('x86');
		});

		it('should correct ia32 for 64-bit systems (Windows)', () => {
			process.env.APPCD_TEST_PLATFORM = 'win32';
			process.env.APPCD_TEST_ARCH = 'ia32';
			process.env.PROCESSOR_ARCHITEW6432 = 'AMD64';

			expect(util.arch(true)).to.equal('x64');
		});

		(process.platform === 'win32' ? it.skip : it)('should correct ia32 for 64-bit systems (Linux)', () => {
			process.env.APPCD_TEST_PLATFORM = 'linux';
			process.env.APPCD_TEST_ARCH = 'ia32';

			expect(util.arch(true)).to.equal('x64');
		});
	});

	describe('assertNodeEngineVersion()', () => {
		afterEach(() => {
			delete process.env.APPCD_TEST_NODE_VERSION;
		});

		it('should error if pkgJson is not a file or object', () => {
			expect(() => {
				util.assertNodeEngineVersion();
			}).to.throw(TypeError, 'Expected pkgJson to be an object or string to a package.json file');
			expect(() => {
				util.assertNodeEngineVersion(null);
			}).to.throw(TypeError, 'Expected pkgJson to be an object or string to a package.json file');
			expect(() => {
				util.assertNodeEngineVersion(['a']);
			}).to.throw(TypeError, 'Expected pkgJson to be an object or string to a package.json file');
			expect(() => {
				util.assertNodeEngineVersion(123);
			}).to.throw(TypeError, 'Expected pkgJson to be an object or string to a package.json file');
		});

		it('should error if package.json file does not exist', () => {
			expect(() => {
				util.assertNodeEngineVersion('foo');
			}).to.throw(Error, 'File does not exist: foo');
		});

		it('should load package.json', () => {
			expect(util.assertNodeEngineVersion(path.join(__dirname, 'fixtures', 'empty-package.json'))).to.be.true;
		});

		it('should error with bad package.json', () => {
			expect(() => {
				util.assertNodeEngineVersion(path.join(__dirname, 'fixtures', 'bad-package.json'));
			}).to.throw(Error, /^Unable to parse package.json\: /);
		});

		it('should succeed without engines definition', () => {
			expect(util.assertNodeEngineVersion({})).to.be.true;
		});

		it('should success if node version is valid', () => {
			process.env.APPCD_TEST_NODE_VERSION = 'v6.9.4';
			expect(util.assertNodeEngineVersion({ engines: { node: '6.9.4' } })).to.be.true;
			expect(util.assertNodeEngineVersion({ engines: { node: 'v6.9.4' } })).to.be.true;
			expect(util.assertNodeEngineVersion(path.join(__dirname, 'fixtures', 'good-package.json'))).to.be.true;
		});

		it('should fail if node version is not valid', () => {
			process.env.APPCD_TEST_NODE_VERSION = 'v6.9.4';
			expect(() => {
				util.assertNodeEngineVersion({ engines: { node: '>=6.9' } });
			}).to.throw(Error, 'Invalid Node engine version in package.json: >=6.9');
			expect(() => {
				util.assertNodeEngineVersion({ engines: { node: '6.9.3' } });
			}).to.throw(Error, 'Requires Node.js \'6.9.3\', but the current version is \'v6.9.4\'');
			expect(() => {
				util.assertNodeEngineVersion({ engines: { node: '7.0.0' } });
			}).to.throw(Error, 'Requires Node.js \'7.0.0\', but the current version is \'v6.9.4\'');
		});
	});

	describe('formatNumber()', () => {
		it('should format a small integer', () => {
			expect(util.formatNumber(12)).to.equal('12');
		});

		it('should format a big integer', () => {
			expect(util.formatNumber(1234567890)).to.equal('1,234,567,890');
		});

		it('should format a small float', () => {
			expect(util.formatNumber(1.2)).to.equal('1.2');
		});

		it('should format a big float', () => {
			expect(util.formatNumber(1234567890.123)).to.equal('1,234,567,890.123');
		});
	});

	describe('mergeDeep()', () => {
		it('should merge two objects together', () => {
			const obj = util.mergeDeep({ a: 1 }, { b: 2 });
			expect(obj).to.deep.equal({ a: 1, b: 2 });
		});

		it('should create a dest object', () => {
			const obj = util.mergeDeep(null, { b: 2 });
			expect(obj).to.deep.equal({ b: 2 });
		});

		it('should return original dest object if source not an object', () => {
			const orig = { b: 2 };
			const obj = util.mergeDeep(orig);
			expect(obj).to.equal(orig);

			const obj2 = util.mergeDeep(orig, 'foo');
			expect(obj2).to.equal(orig);
		});

		it('should merge deeply nested properties', () => {
			const fn = () => {};

			const obj = util.mergeDeep(
				{
					a: 1,
					d: null,
					g: [],
					h: ['a'],
					i: { j: {} }
				},
				{
					a: 2,
					b: 3,
					c: [ 'x', 'y', 'z' ],
					d: { fn: fn },
					e: undefined,
					f: null,
					g: { foo: 'bar' },
					h: ['b', 'c'],
					i: { j: { k: 'l' } }
				}
			);

			expect(obj).to.deep.equal({
				a: 2,
				b: 3,
				c: [ 'x', 'y', 'z' ],
				d: { fn: fn },
				f: null,
				g: { foo: 'bar' },
				h: ['a', 'b', 'c'],
				i: { j: { k: 'l' } }
			});
		});
	});

	describe('randomBytes()', () => {
		it('should return 0 random bytes', () => {
			const r = util.randomBytes(0);
			expect(r).to.be.a.String;
			expect(r).to.have.lengthOf(0);
		});

		it('should return 1 random byte', () => {
			const r = util.randomBytes(1);
			expect(r).to.be.a.String;
			expect(r).to.have.lengthOf(2);
		});

		it('should return 2 random bytes', () => {
			const r = util.randomBytes(2);
			expect(r).to.be.a.String;
			expect(r).to.have.lengthOf(4);
		});

		it('should return 20 random bytes', () => {
			const r = util.randomBytes(20);
			expect(r).to.be.a.String;
			expect(r).to.have.lengthOf(40);
		});
	});

	describe('sha1()', () => {
		it('should hash a string', () => {
			const h1 = util.sha1('foo');
			expect(h1).to.be.a.String;
			expect(h1).to.have.lengthOf(40);

			const h2 = util.sha1('bar');
			expect(h2).to.be.a.String;
			expect(h2).to.have.lengthOf(40);

			expect(h1).to.not.equal(h2);
		});
	});

});
