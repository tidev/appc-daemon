import * as util from '../dist/util';

describe('util', () => {

	describe('existsSync', () => {
		it('should check if a file exists', () => {
			expect(util.existsSync(__dirname + '/setup.js')).to.be.true;
			expect(util.existsSync(__dirname + '/nosuchfile')).to.be.false;
		});

		it('should check if a directory exists', () => {
			expect(util.existsSync(__dirname + '/../node_modules')).to.be.true;
			expect(util.existsSync(__dirname + '/../nosuchdir')).to.be.false;
		});
	});

	describe('mergeDeep', () => {
		it('should merge two objects together', function () {
			const obj = util.mergeDeep({ a: 1 }, { b: 2 });
			expect(obj).to.deep.equal({ a: 1, b: 2 });
		});
	});

	describe('expandPath', () => {
		it('should resolve the home directory', function () {
			const path = util.expandPath('~/foo');
			expect(path).to.match(/^.*\/foo$/);
		});

		it('should collapse relative segments', function () {
			const path = util.expandPath('/path/./to/../foo');
			expect(path).to.equal('/path/foo');
		});
	});

});
