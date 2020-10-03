import fs from 'fs-extra';
import path from 'path';
import tmp from 'tmp';

import {
	downloadNode,
	extractNode,
	getNodeFilename,
	prepareNode,
	purgeUnusedNodejsExecutables,
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

		it('should error if architecture is invalid', async () => {
			await expect(prepareNode({ arch: {} }))
				.to.eventually.be.rejectedWith(Error, 'Expected arch to be "x86" or "x64"');
			await expect(prepareNode({ arch: 'foo' }))
				.to.eventually.be.rejectedWith(Error, 'Expected arch to be "x86" or "x64"');
		});

		it('should error if node home is invalid', async () => {
			await expect(prepareNode({}))
				.to.eventually.be.rejectedWith(TypeError, 'Expected Node home to be a non-empty string');
			await expect(prepareNode({ arch: 'x64' }))
				.to.eventually.be.rejectedWith(TypeError, 'Expected Node home to be a non-empty string');
			await expect(prepareNode({ arch: 'x64', nodeHome: null }))
				.to.eventually.be.rejectedWith(TypeError, 'Expected Node home to be a non-empty string');
			await expect(prepareNode({ arch: 'x64', nodeHome: '' }))
				.to.eventually.be.rejectedWith(TypeError, 'Expected Node home to be a non-empty string');
			await expect(prepareNode({ arch: 'x64', nodeHome: 123 }))
				.to.eventually.be.rejectedWith(TypeError, 'Expected Node home to be a non-empty string');
		});

		it('should error if version is invalid', async () => {
			await expect(prepareNode({ arch: 'x64', nodeHome: 'foo' }))
				.to.eventually.be.rejectedWith(TypeError, 'Expected version to be a non-empty string');
			await expect(prepareNode({ arch: 'x64', nodeHome: 'foo', version: null }))
				.to.eventually.be.rejectedWith(TypeError, 'Expected version to be a non-empty string');
			await expect(prepareNode({ arch: 'x64', nodeHome: 'foo', version: '' }))
				.to.eventually.be.rejectedWith(TypeError, 'Expected version to be a non-empty string');
			await expect(prepareNode({ arch: 'x64', nodeHome: 'foo', version: 123 }))
				.to.eventually.be.rejectedWith(TypeError, 'Expected version to be a non-empty string');
		});
	});

	describe('downloadNode()', () => {
		afterEach(() => {
			delete process.env.APPCD_TEST_PLATFORM;
		});

		it('should download Node.js 10.15.0 for Linux', async function () {
			this.timeout(120000);
			this.slow(100000);

			const tmpDir = makeTempDir();

			process.env.APPCD_TEST_PLATFORM = 'linux';

			const binary = await downloadNode({
				arch: 'x64',
				nodeHome: tmpDir,
				version: '10.15.0' // test without the 'v'
			});

			expect(binary).to.equal(path.join(tmpDir, 'v10.15.0', 'linux', 'x64', 'node'));
		});

		it('should download Node.js 10.15.0 for Windows', async function () {
			this.timeout(120000);
			this.slow(100000);

			const tmpDir = makeTempDir();

			process.env.APPCD_TEST_PLATFORM = 'win32';

			const binary = await downloadNode({
				arch: 'x64',
				nodeHome: tmpDir,
				version: 'v10.15.0'
			});

			expect(binary).to.equal(path.join(tmpDir, 'v10.15.0', 'win32', 'x64', 'node.exe'));
		});

		(process.platform === 'darwin' ? it : it.skip)('should download Node.js 10.15.0 for macOS', async function () {
			this.timeout(120000);
			this.slow(100000);

			const tmpDir = makeTempDir();

			process.env.APPCD_TEST_PLATFORM = 'darwin';

			const binary = await downloadNode({
				arch: 'x64',
				nodeHome: tmpDir,
				version: 'v10.15.0'
			});

			expect(binary).to.equal(path.join(tmpDir, 'v10.15.0', 'darwin', 'x64', 'node'));
		});

		it('should error if version does not exist', async function () {
			this.timeout(120000);
			this.slow(100000);

			const tmpDir = makeTempDir();

			process.env.APPCD_TEST_PLATFORM = 'linux';

			try {
				await downloadNode({
					arch: 'x64',
					nodeHome: tmpDir,
					version: 'v123'
				});
			} catch (err) {
				expect(err).to.be.an.instanceof(Error);
				expect(err.message).to.match(/^Failed to download Node\.js: 404/);
				return;
			}

			throw new Error('Expected 404');
		});
	});

	describe('extractNode()', () => {
		it('should fail if invalid archive type', async () => {
			try {
				await extractNode({
					archive: path.join(__dirname, 'fixtures', 'bad.txt')
				});
			} catch (err) {
				expect(err.message).to.match(/^Unsupported archive/);
				return;
			}

			throw new Error('Expected unsupported archive error');
		});

		it('should error if dest is missing', async () => {
			try {
				await extractNode({
					archive: path.join(__dirname, 'fixtures', 'bad.zip')
				});
			} catch (err) {
				expect(err).to.be.an.instanceof(Error);
				return;
			}

			throw new Error('Expected bad dest error');
		});

		it('should error if dest is an empty string', async () => {
			try {
				await extractNode({
					archive: path.join(__dirname, 'fixtures', 'bad.zip'),
					dest: ''
				});
			} catch (err) {
				expect(err).to.be.an.instanceof(Error);
				return;
			}

			throw new Error('Expected bad dest error');
		});

		it('should error if dest is not a string', async () => {
			try {
				await extractNode({
					archive: path.join(__dirname, 'fixtures', 'bad.zip'),
					dest: function () {}
				});
			} catch (err) {
				expect(err).to.be.an.instanceof(Error);
				return;
			}

			throw new Error('Expected bad dest error');
		});

		it('should fail to extract bad zip file', async () => {
			const tmpDir = makeTempDir();

			try {
				await extractNode({
					archive: path.join(__dirname, 'fixtures', 'bad.zip'),
					dest: tmpDir
				});
			} catch (err) {
				expect(err).to.be.an.instanceof(Error);
				return;
			} finally {
				await fs.remove(tmpDir);
			}

			throw new Error('Expected bad zip to not be extracted');
		});

		it('should fail to extract bad tarball file', async () => {
			const tmpDir = makeTempDir();

			try {
				await extractNode({
					archive: path.join(__dirname, 'fixtures', 'bad.tar.gz'),
					dest: tmpDir
				});
			} catch (err) {
				expect(err).to.be.an.instanceof(Error);
				return;
			} finally {
				await fs.remove(tmpDir);
			}

			throw new Error('Expected bad tarball to not be extracted');
		});

		it('should fail to extract bad pkg file', async () => {
			const tmpDir = makeTempDir();

			try {
				await extractNode({
					archive: path.join(__dirname, 'fixtures', 'bad.pkg'),
					dest: tmpDir
				});
			} catch (err) {
				expect(err).to.be.an.instanceof(Error);
				return;
			} finally {
				await fs.remove(tmpDir);
			}

			throw new Error('Expected bad pkg to not be extracted');
		});

		it('should fail to extract invalid node zip file', async () => {
			const tmpDir = makeTempDir();

			try {
				await extractNode({
					archive: path.join(__dirname, 'fixtures', 'invalid.zip'),
					dest: tmpDir
				});
			} catch (err) {
				expect(err).to.be.an.instanceof(Error);
				return;
			} finally {
				await fs.remove(tmpDir);
			}

			throw new Error('Expected invalid node zip to not be extracted');
		});

		it('should fail to extract invalid node tarball file', async () => {
			const tmpDir = makeTempDir();

			try {
				await extractNode({
					archive: path.join(__dirname, 'fixtures', 'invalid.tar.gz'),
					dest: tmpDir
				});
			} catch (err) {
				expect(err).to.be.an.instanceof(Error);
				return;
			} finally {
				await fs.remove(tmpDir);
			}

			throw new Error('Expected invalid node tarball to not be extracted');
		});
	});

	describe('spawnNode()', () => {
		it('should prepare and spawn Node 10.15.0', async function () {
			this.timeout(120000);
			this.slow(100000);

			const tmpDir = makeTempDir();

			try {
				await spawnNode({
					args: [ path.join(__dirname, 'fixtures', 'test.js') ],
					nodeHome: tmpDir,
					version: '10.15.0' // test without the 'v'
				});

				const child = await spawnNode({
					args: [ path.join(__dirname, 'fixtures', 'test.js'), 'foo bar' ],
					nodeHome: tmpDir,
					detached: true,
					version: 'v10.15.0',
					nodeArgs: [ '--max_old_space_size=500' ]
				});

				await new Promise(resolve => child.on('close', resolve));
			} finally {
				await fs.remove(tmpDir);
			}
		});

		it('should error if v8mem is invalid', async () => {
			try {
				await spawnNode({ v8mem: 'foo' });
			} catch (err) {
				expect(err).to.be.an.instanceof(TypeError);
				expect(err.message).to.equal('Expected v8mem to be a number or "auto"');
				return;
			}

			throw new Error('Expected v8mem error');
		});

		it('should error if arch is invalid', async () => {
			try {
				await spawnNode({ arch: 'foo' });
			} catch (err) {
				expect(err.message).to.equal('Expected arch to be "x86" or "x64"');
				return;
			}

			throw new Error('Expected exception to be thrown');
		});
	});

	describe('purgeUnusedNodejsExecutables()', () => {
		it('should find all unused Node.js executables', () => {
			const nodeExecutable = getNodeFilename();
			const now = Date.now();
			const { platform } = process;
			const tmpDir = makeTempDir();

			const createNodeExecutable = (dir, lastrun) => {
				fs.mkdirsSync(dir);
				fs.writeFileSync(path.join(dir, nodeExecutable), '# mock node executable');
				if (lastrun) {
					fs.writeFileSync(path.join(dir, '.lastrun'), lastrun.toString());
				}
			};

			createNodeExecutable(path.join(tmpDir, 'v8.9.1', platform, 'x64'));
			createNodeExecutable(path.join(tmpDir, 'v8.9.2', platform, 'x64'), now - (24 * 60 * 60 * 1000)); // 1 day
			createNodeExecutable(path.join(tmpDir, 'v8.9.3', platform, 'x64'), now);

			const results = purgeUnusedNodejsExecutables({
				maxAge: 60 * 1000, // 1 minute
				nodeHome: tmpDir
			});

			expect(results).to.deep.equal([
				{
					arch: 'x64',
					platform,
					version: 'v8.9.2'
				}
			]);

			expect(() => {
				fs.statSync(path.join(tmpDir, 'v8.9.1', platform, 'x64', nodeExecutable));
				fs.statSync(path.join(tmpDir, 'v8.9.1', platform, 'x64', '.lastrun'));
			}).to.not.throw();

			expect(() => {
				fs.statSync(path.join(tmpDir, 'v8.9.2', platform, 'x64', nodeExecutable));
			}).to.throw();

			expect(() => {
				fs.statSync(path.join(tmpDir, 'v8.9.2', platform, 'x64', '.lastrun'));
			}).to.throw();

			expect(() => {
				fs.statSync(path.join(tmpDir, 'v8.9.3', platform, 'x64', nodeExecutable));
				fs.statSync(path.join(tmpDir, 'v8.9.3', platform, 'x64', '.lastrun'));
			}).to.not.throw();
		});
	});
});
