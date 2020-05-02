import fs from 'fs-extra';
import tmp from 'tmp';
import _path from 'path';

import * as path from '../dist/path';

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

	describe('real()', () => {
		it('should figure out the real path for a non-symlinked existing file', () => {
			expect(path.real(__filename)).to.equal(__filename);
		});

		it('should figure out the real path for a symlinked existing file', () => {
			const tmpObj = tmp.dirSync({
				mode: '755',
				prefix: 'appcd-path-test-'
			});
			const dir = _path.join(tmpObj.name, 'bar');
			const filename = _path.join(tmpObj.name, 'foo.txt');
			const symFilename = _path.join(tmpObj.name, 'bar', 'foo.txt');

			fs.writeFileSync(filename, 'foo!');
			fs.mkdirSync(dir);
			fs.symlinkSync(filename, symFilename);

			try {
				expect(path.real(symFilename)).to.equal(fs.realpathSync(filename));
			} finally {
				fs.removeSync(tmpObj.name);
			}
		});

		it('should figure out the real path for a non-symlinked non-existent file', () => {
			const tmpObj = tmp.dirSync({
				mode: '755',
				prefix: 'appcd-path-test-'
			});
			const filename = _path.join(tmpObj.name, 'foo.txt');

			try {
				expect(path.real(filename)).to.equal(_path.join(fs.realpathSync(tmpObj.name), 'foo.txt'));
			} finally {
				fs.removeSync(tmpObj.name);
			}
		});

		it('should figure out the real path for a symlinked nested non-existent directory', () => {
			const dir = tmp.dirSync({
				mode: '755',
				prefix: 'appcd-path-test-'
			}).name;

			const foo = _path.join(dir, 'foo');
			const bar = _path.join(dir, 'bar');

			const foobaz = _path.join(dir, 'foo', 'baz');
			const barbaz = _path.join(fs.realpathSync(dir), 'bar', 'baz');

			// link foo to bar
			fs.symlinkSync(bar, foo);

			expect(path.real(foobaz)).to.equal(barbaz);
		});
	});
});
