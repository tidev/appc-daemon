import fs from 'fs';
import path from 'path';
import tmp from 'tmp';

import {
	existsSync,
	isDir,
	isFile,
	locate,
	mkdirpSync,
	moveSync,
	readdirScopedSync,
	writeFileSync
} from '../dist/fs';

const {
	name: tmpDir,
	removeCallback
} = tmp.dirSync({
	mode: '755',
	prefix: 'appcd-fs-test-',
	unsafeCleanup: true
});

describe('fs', () => {
	after(() => removeCallback());

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
			expect(result).to.be.a('string');
			expect(result).to.equal(path.join(baseDir, 'subdir1', 'foo.txt'));

			result = locate(baseDir, 'bar.txt');
			expect(result).to.be.a('string');
			expect(result).to.equal(path.join(baseDir, 'subdir1', 'subdir2', 'bar.txt'));
		});

		it('should find a file using a regex', () => {
			let result = locate(baseDir, /foo\.txt/);
			expect(result).to.be.a('string');
			expect(result).to.equal(path.join(baseDir, 'subdir1', 'foo.txt'));

			result = locate(baseDir, /bar\.txt/);
			expect(result).to.be.a('string');
			expect(result).to.equal(path.join(baseDir, 'subdir1', 'subdir2', 'bar.txt'));
		});

		it('should find a file with depth', () => {
			const result = locate(baseDir, 'foo.txt', 1);
			expect(result).to.be.a('string');
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

	describe('mkdirpSync()', () => {
		afterEach(() => {
			try {
				fs.rmdirSync(tmpDir, { recursive: true });
			} catch (e) {
				// requires Node 12.10.0
			}
		});

		it('should create a directory', () => {
			const p = path.join(tmpDir, 'foo', 'bar');
			expect(fs.existsSync(p)).to.equal(false);
			mkdirpSync(p);
			expect(fs.existsSync(p)).to.equal(true);
		});
	});

	describe('moveSync()', () => {
		afterEach(() => {
			try {
				fs.rmdirSync(tmpDir, { recursive: true });
			} catch (e) {
				// requires Node 12.10.0
			}
		});

		it('should move a file to a directory', () => {
			const src = path.join(tmpDir, 'foo', 'bar.txt');
			writeFileSync(src, 'Hello World!');

			const dest = path.join(tmpDir, 'baz', 'wiz.txt');
			moveSync(src, dest);
			expect(fs.existsSync(src)).to.equal(false);
			expect(fs.existsSync(dest)).to.equal(true);
		});

		it('should error if source file does not exist', () => {
			expect(() => {
				moveSync('does_not_exist', tmpDir);
			}).to.throw(Error, /^ENOENT/);
		});
	});

	describe('readdirScoped', () => {
		const baseDir = path.resolve(__dirname, './fixtures/readdirScopedSync');
		it('should read dir and have scoped packages as a single entry', () => {
			const dirs = readdirScopedSync(baseDir);
			expect(dirs).to.deep.equal([ '@test/bar', '@test/foo', 'bar', 'foo' ]);
		});

		it('should work normally when no scopes exists and filter files out', () => {
			const dirs = readdirScopedSync(__dirname);
			expect(dirs).to.deep.equal([ 'fixtures' ]);
		});
	});

	describe('writeFileSync()', () => {
		afterEach(() => {
			try {
				fs.rmdirSync(tmpDir, { recursive: true });
			} catch (e) {
				// requires Node 12.10.0
			}
		});

		it('should write a file', () => {
			const f = path.join(tmpDir, 'foo', 'bar.txt');
			writeFileSync(f, 'Hello World!');
			expect(fs.readFileSync(f, 'utf8')).to.equal('Hello World!');
		});
	});
});
