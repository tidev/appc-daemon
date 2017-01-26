import * as util from '../src/index';

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
					h: ['a']
				},
				{
					a: 2,
					b: 3,
					c: [ 'x', 'y', 'z' ],
					d: { fn: fn },
					e: undefined,
					f: null,
					g: { foo: 'bar' },
					h: ['b', 'c']
				}
			);

			expect(obj).to.deep.equal({
				a: 2,
				b: 3,
				c: [ 'x', 'y', 'z' ],
				d: { fn: fn },
				f: null,
				g: { foo: 'bar' },
				h: ['a', 'b', 'c']
			});
		});
	});

});
