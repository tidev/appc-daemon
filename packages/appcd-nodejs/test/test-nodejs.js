import fs from 'fs-extra';
import path from 'path';
import tmp from 'tmp';

import {
	prepareNode,
	downloadNode,
	extractNode,
	spawnNode
} from '../dist/nodejs';

tmp.setGracefulCleanup();
function makeTempDir() {
	return tmp.dirSync({
		mode: '755',
		prefix: 'appcd-nodejs-test-',
		unsafeCleanup: true
	}).name;
}

describe('nodejs', () => {
	describe('prepareNode()', () => {
		afterEach(() => {
			delete process.env.APPCD_TEST_PLATFORM;
		});

		it('should error if architecture is invalid', () => {
			expect(() => {
				prepareNode({ arch: {} });
			}).to.throw(Error, 'Expected arch to be "x86" or "x64"');

			expect(() => {
				prepareNode({ arch: 'foo' });
			}).to.throw(Error, 'Expected arch to be "x86" or "x64"');
		});

		it('should error if node home is invalid', () => {
			expect(() => {
				prepareNode({});
			}).to.throw(TypeError, 'Expected Node home to be a non-empty string');

			expect(() => {
				prepareNode({ arch: 'x64' });
			}).to.throw(TypeError, 'Expected Node home to be a non-empty string');

			expect(() => {
				prepareNode({ arch: 'x64', nodeHome: null });
			}).to.throw(TypeError, 'Expected Node home to be a non-empty string');

			expect(() => {
				prepareNode({ arch: 'x64', nodeHome: '' });
			}).to.throw(TypeError, 'Expected Node home to be a non-empty string');

			expect(() => {
				prepareNode({ arch: 'x64', nodeHome: 123 });
			}).to.throw(TypeError, 'Expected Node home to be a non-empty string');
		});

		it('should error if version is invalid', () => {
			expect(() => {
				prepareNode({ arch: 'x64', nodeHome: 'foo' });
			}).to.throw(TypeError, 'Expected version to be a non-empty string');

			expect(() => {
				prepareNode({ arch: 'x64', nodeHome: 'foo', version: null });
			}).to.throw(TypeError, 'Expected version to be a non-empty string');

			expect(() => {
				prepareNode({ arch: 'x64', nodeHome: 'foo', version: '' });
			}).to.throw(TypeError, 'Expected version to be a non-empty string');

			expect(() => {
				prepareNode({ arch: 'x64', nodeHome: 'foo', version: 123 });
			}).to.throw(TypeError, 'Expected version to be a non-empty string');
		});
	});

	describe('downloadNode()', () => {
		afterEach(() => {
			delete process.env.APPCD_TEST_PLATFORM;
		});

		it('should download Node.js 6.9.5 for Linux', function (done) {
			this.timeout(120000);
			this.slow(100000);

			const tmpDir = makeTempDir();

			process.env.APPCD_TEST_PLATFORM = 'linux';

			Promise.resolve()
				.then(() => downloadNode({
					arch: 'x64',
					nodeHome: tmpDir,
					version: '6.9.5' // test without the 'v'
				}))
				.then(binary => {
					expect(binary).to.equal(path.join(tmpDir, 'v6.9.5', 'linux', 'x64', 'node'));
					done();
				})
				.catch(done);
		});

		it('should download Node.js 6.9.5 for Windows', function (done) {
			this.timeout(120000);
			this.slow(100000);

			const tmpDir = makeTempDir();

			process.env.APPCD_TEST_PLATFORM = 'win32';

			Promise.resolve()
				.then(() => downloadNode({
					arch: 'x64',
					nodeHome: tmpDir,
					version: 'v6.9.5'
				}))
				.then(binary => {
					expect(binary).to.equal(path.join(tmpDir, 'v6.9.5', 'win32', 'x64', 'node.exe'));
					done();
				})
				.catch(done);
		});

		(process.platform === 'darwin' ? it : it.skip)('should download Node.js 6.9.5 for macOS', function (done) {
			this.timeout(120000);
			this.slow(100000);

			const tmpDir = makeTempDir();

			process.env.APPCD_TEST_PLATFORM = 'darwin';

			Promise.resolve()
				.then(() => downloadNode({
					arch: 'x64',
					nodeHome: tmpDir,
					version: 'v6.9.5'
				}))
				.then(binary => {
					expect(binary).to.equal(path.join(tmpDir, 'v6.9.5', 'darwin', 'x64', 'node'));
					done();
				})
				.catch(done);
		});

		it('should error if version does not exist', function (done) {
			this.timeout(120000);
			this.slow(100000);

			const tmpDir = makeTempDir();

			process.env.APPCD_TEST_PLATFORM = 'linux';

			downloadNode({
				arch: 'x64',
				nodeHome: tmpDir,
				version: 'v123'
			}).then(() => {
				done(new Error('Expected 404'));
			}).catch(err => {
				expect(err).to.be.an.instanceof(Error);
				expect(err.message).to.match(/^Failed to download Node\.js: 404/);
				done();
			});
		});
	});

	describe('extractNode()', () => {
		it('should fail if invalid archive type', done => {
			extractNode({
				archive: path.join(__dirname, 'fixtures', 'bad.txt')
			}).then(() => {
				done(new Error('Expected unsupported archive error'));
			}).catch(err => {
				expect(err.message).to.match(/^Unsupported archive/);
				done();
			});
		});

		it('should error if dest is missing', done => {
			extractNode({
				archive: path.join(__dirname, 'fixtures', 'bad.zip')
			}).then(() => {
				done(new Error('Expected bad dest error'));
			}).catch(err => {
				expect(err).to.be.an.instanceof(Error);
				done();
			});
		});

		it('should error if dest is an empty string', done => {
			extractNode({
				archive: path.join(__dirname, 'fixtures', 'bad.zip'),
				dest: ''
			}).then(() => {
				done(new Error('Expected bad dest error'));
			}).catch(err => {
				expect(err).to.be.an.instanceof(Error);
				done();
			});
		});

		it('should error if dest is not a string', done => {
			extractNode({
				archive: path.join(__dirname, 'fixtures', 'bad.zip'),
				dest: function () {}
			}).then(() => {
				done(new Error('Expected bad dest error'));
			}).catch(err => {
				expect(err).to.be.an.instanceof(Error);
				done();
			});
		});

		it('should fail to extract bad zip file', done => {
			const tmpDir = makeTempDir();

			extractNode({
				archive: path.join(__dirname, 'fixtures', 'bad.zip'),
				dest: tmpDir
			}).then(() => {
				fs.removeSync(tmpDir);
				done(new Error('Expected bad zip to not be extracted'));
			}).catch(err => {
				fs.removeSync(tmpDir);
				expect(err).to.be.an.instanceof(Error);
				done();
			});
		});

		it('should fail to extract bad tarball file', done => {
			const tmpDir = makeTempDir();

			extractNode({
				archive: path.join(__dirname, 'fixtures', 'bad.tar.gz'),
				dest: tmpDir
			}).then(() => {
				fs.removeSync(tmpDir);
				done(new Error('Expected bad tarball to not be extracted'));
			}).catch(err => {
				fs.removeSync(tmpDir);
				expect(err).to.be.an.instanceof(Error);
				done();
			});
		});

		it('should fail to extract bad pkg file', done => {
			const tmpDir = makeTempDir();

			extractNode({
				archive: path.join(__dirname, 'fixtures', 'bad.pkg'),
				dest: tmpDir
			}).then(() => {
				fs.removeSync(tmpDir);
				done(new Error('Expected bad pkg to not be extracted'));
			}).catch(err => {
				fs.removeSync(tmpDir);
				expect(err).to.be.an.instanceof(Error);
				done();
			});
		});

		it('should fail to extract invalid node zip file', done => {
			const tmpDir = makeTempDir();

			extractNode({
				archive: path.join(__dirname, 'fixtures', 'invalid.zip'),
				dest: tmpDir
			}).then(() => {
				fs.removeSync(tmpDir);
				done(new Error('Expected invalid node zip to not be extracted'));
			}).catch(err => {
				fs.removeSync(tmpDir);
				expect(err).to.be.an.instanceof(Error);
				done();
			});
		});

		it('should fail to extract invalid node tarball file', done => {
			const tmpDir = makeTempDir();

			extractNode({
				archive: path.join(__dirname, 'fixtures', 'invalid.tar.gz'),
				dest: tmpDir
			}).then(() => {
				fs.removeSync(tmpDir);
				done(new Error('Expected invalid node tarball to not be extracted'));
			}).catch(err => {
				fs.removeSync(tmpDir);
				expect(err).to.be.an.instanceof(Error);
				done();
			});
		});
	});

	describe('spawnNode()', () => {
		it('should prepare and spawn Node 6.9.5', function (done) {
			this.timeout(120000);
			this.slow(100000);

			const tmpDir = makeTempDir();

			Promise.resolve()
				.then(() => spawnNode({
					args: [ path.join(__dirname, 'fixtures', 'test.js') ],
					nodeHome: tmpDir,
					version: '6.9.5' // test without the 'v'
				}))
				.then(() => spawnNode({
					args: [ path.join(__dirname, 'fixtures', 'test.js'), 'foo bar' ],
					nodeHome: tmpDir,
					detached: true,
					version: 'v6.9.5',
					nodeArgs: [ '--max_old_space_size=500' ]
				}))
				.then(() => {
					fs.removeSync(tmpDir);
					done();
				})
				.catch(err => {
					fs.removeSync(tmpDir);
					done(err);
				});
		});

		it('should error if v8mem is invalid', done => {
			spawnNode({ v8mem: 'foo' })
				.then(() => done(new Error('Expected v8mem error')))
				.catch(err => {
					expect(err).to.be.an.instanceof(TypeError);
					expect(err.message).to.equal('Expected v8mem to be a number or "auto"');
					done();
				});
		});

		it('should error if arch is invalid', () => {
			expect(() => {
				spawnNode({ arch: 'foo' });
			}).to.throw(Error, 'Expected arch to be "x86" or "x64"');
		});
	});
});
