import * as path from '../src/index';

describe('path', () => {
	describe('expandPath()', () => {
		beforeEach(function () {
			this.HOME        = process.env.HOME;
			this.USERPROFILE = process.env.USERPROFILE;
			this.SystemRoot  = process.env.SystemRoot;
		});

		afterEach(function () {
			this.HOME        && (process.env.HOME        = this.HOME);
			this.USERPROFILE && (process.env.USERPROFILE = this.USERPROFILE);
			this.SystemRoot  && (process.env.SystemRoot = this.SystemRoot);
			delete process.env.APPCD_TEST_PLATFORM;
		});

		const isWin = /^win/.test(process.platform);

		it('should resolve the home directory using HOME', () => {
			process.env.HOME = isWin ? 'C:\\Users\\username' : '/Users/username';
			delete process.env.USERPROFILE;

			const p = path.expandPath('~/foo');
			expect(p).to.equal(isWin ? 'C:\\Users\\username\\foo' : '/Users/username/foo');
		});

		it('should resolve the home directory using USERPROFILE', () => {
			delete process.env.HOME;
			process.env.USERPROFILE = isWin ? 'C:\\Users\\username' : '/Users/username';

			const p = path.expandPath('~/foo');
			expect(p).to.equal(isWin ? 'C:\\Users\\username\\foo' : '/Users/username/foo');
		});

		it('should collapse relative segments', () => {
			const p = path.expandPath('/path/./to/../foo');
			expect(p).to.equal(isWin ? 'C:\\path\\foo' : '/path/foo');
		});

		it('should resolve environment paths (Windows)', () => {
			process.env.APPCD_TEST_PLATFORM = 'win32';
			process.env.SystemRoot = 'C:\\WINDOWS';
			const p = path.expandPath('%SystemRoot%\\foo');
			expect(isWin ? p : p.substring(process.cwd().length + 1)).to.equal('C:\\WINDOWS\\foo');
		});
	});
});
