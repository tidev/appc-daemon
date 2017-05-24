import path from 'path';

import {
	existsSync,
	isDir,
	isFile,
	locate
} from '../dist/fs';

describe('fs', () => {
	describe('existsSync()', () => {
		it('should check if a file exists', () => {
			expect(existsSync(__filename)).to.be.true;
			expect(existsSync(path.resolve(__dirname, './nosuchfile'))).to.be.false;
		});

		it('should check if a directory exists', () => {
			expect(existsSync(path.resolve(__dirname, './fixtures'))).to.be.true;
			expect(existsSync(path.resolve(__dirname, './fixtures/nosuchdir'))).to.be.false;
		});
	});

	describe('isDir()', () => {
		it('should succeed if a directory exists', () => {
			expect(isDir(__dirname)).to.be.true;
		});

		it('should fail if a directory does not exist', () => {
			expect(isDir(path.join(__dirname, 'doesnotexist'))).to.be.false;
		});

		it('should fail if a directory is a file', () => {
			expect(isDir(__filename)).to.be.false;
		});
	});

	describe('isFile()', () => {
		it('should succeed if a file exists', () => {
			expect(isFile(__filename)).to.be.true;
		});

		it('should fail if a file does not exist', () => {
			expect(isFile(path.join(__dirname, 'doesnotexist'))).to.be.false;
		});

		it('should fail if a file is a directory', () => {
			expect(isFile(__dirname)).to.be.false;
		});
	});

	describe('locate()', () => {
		const baseDir = path.resolve(__dirname, './fixtures/locate');

		it('should find a file with no depth', () => {
			let result = locate(baseDir, 'foo.txt');
			expect(result).to.be.a.String;
			expect(result).to.equal(path.join(baseDir, 'subdir1', 'foo.txt'));

			result = locate(baseDir, 'bar.txt');
			expect(result).to.be.a.String;
			expect(result).to.equal(path.join(baseDir, 'subdir1', 'subdir2', 'bar.txt'));
		});

		it('should find a file using a regex', () => {
			let result = locate(baseDir, /foo\.txt/);
			expect(result).to.be.a.String;
			expect(result).to.equal(path.join(baseDir, 'subdir1', 'foo.txt'));

			result = locate(baseDir, /bar\.txt/);
			expect(result).to.be.a.String;
			expect(result).to.equal(path.join(baseDir, 'subdir1', 'subdir2', 'bar.txt'));
		});

		it('should find a file with depth', () => {
			const result = locate(baseDir, 'foo.txt', 1);
			expect(result).to.be.a.String;
			expect(result).to.equal(path.join(baseDir, 'subdir1', 'foo.txt'));
		});

		it('should not find non-existant file', () => {
			const result = locate(baseDir, 'baz.txt');
			expect(result).to.be.null;
		});

		it('should not find a file with depth', () => {
			const result = locate(baseDir, 'bar.txt', 1);
			expect(result).to.be.null;
		});
	});
});
