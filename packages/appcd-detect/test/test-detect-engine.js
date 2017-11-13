import appcdLogger from 'appcd-logger';
import DetectEngine from '../dist/index';
import Dispatcher from 'appcd-dispatcher';
import fs from 'fs-extra';
import FSWatchManager, { status } from 'appcd-fswatcher';
import gawk from 'gawk';
import path from 'path';
import tmp from 'tmp';

import { isFile } from 'appcd-fs';
import { real } from 'appcd-path';
import { sleep } from 'appcd-util';

const { log } = appcdLogger('test:appcd:detect');
const { highlight } = appcdLogger.styles;

const _tmpDir = tmp.dirSync({
	prefix: 'appcd-detect-test-',
	unsafeCleanup: true
}).name;
const tmpDir = real(_tmpDir);

function makeTempName() {
	return path.join(_tmpDir, Math.random().toString(36).substring(7));
}

function makeTempDir() {
	const dir = makeTempName();
	fs.mkdirsSync(dir);
	return dir;
}

function statusHandler() {
	// noop
}

describe('Detect', () => {
	before(function () {
		Dispatcher.register('/appcd/status', statusHandler);
		this.fsw = new FSWatchManager();
		Dispatcher.register('/appcd/fswatch', this.fsw);
	});

	after(function () {
		Dispatcher.unregister('/appcd/fswatch', this.fsw);
		this.fsw.shutdown();
		Dispatcher.unregister('/appcd/status', statusHandler);
		fs.removeSync(tmpDir);
	});

	describe('constructor()', () => {
		it('should reject if checkDir is not a function', () => {
			expect(() => {
				new DetectEngine();
			}).to.throw(TypeError, 'Expected "checkDir" option to be a function');

			expect(() => {
				new DetectEngine({
					checkDir: 123
				});
			}).to.throw(TypeError, 'Expected "checkDir" option to be a function');
		});

		it('should reject if env is not a string', () => {
			expect(() => {
				new DetectEngine({
					checkDir() {},
					env: 123
				});
			}).to.throw(TypeError, 'Expected "env" option to be a string or an array of strings');
		});

		it('should reject if env is not an array of strings', () => {
			expect(() => {
				new DetectEngine({
					checkDir() {},
					env: [ 'foo', 123 ]
				});
			}).to.throw(TypeError, 'Expected "env" option to be a string or an array of strings');
		});

		it('should reject if exe is not a string', () => {
			expect(() => {
				new DetectEngine({
					checkDir() {},
					exe: 123
				});
			}).to.throw(TypeError, 'Expected "exe" option to be a non-empty string or an array or set of non-empty strings');
		});

		it('should reject if exe is an empty string', () => {
			expect(() => {
				new DetectEngine({
					checkDir() {},
					exe: ''
				});
			}).to.throw(TypeError, 'Expected "exe" option to be a non-empty string or an array or set of non-empty strings');
		});

		it('should reject if paths is not a string', () => {
			expect(() => {
				new DetectEngine({
					checkDir() {},
					paths: 123
				});
			}).to.throw(TypeError, 'Expected "paths" option to be a non-empty string or an array or set of non-empty strings');
		});

		it('should reject if paths is not an array of strings', () => {
			expect(() => {
				new DetectEngine({
					checkDir() {},
					paths: [ 'foo', 123 ]
				});
			}).to.throw(TypeError, 'Expected "paths" option to be a non-empty string or an array or set of non-empty strings');
		});

		it('should reject if processResults() is not a function', () => {
			expect(() => {
				new DetectEngine({
					checkDir() {},
					processResults: 123
				});
			}).to.throw(TypeError, 'Expected "processResults" option to be a function');
		});

		it('should reject if registryCallback is not a function', () => {
			expect(() => {
				new DetectEngine({
					checkDir() {},
					registryCallback: 123
				});
			}).to.throw(TypeError, 'Expected "registryCallback" option to be a function');
		});

		it('should reject if registryKeys is not a function or object', () => {
			expect(() => {
				new DetectEngine({
					checkDir() {},
					registryKeys: 'foo'
				});
			}).to.throw(TypeError, 'Expected "registryKeys" option to be an object or array of objects with a "hive", "key", and "name"');
		});

		it('should reject if registryKeys is an array with a non-object', () => {
			expect(() => {
				new DetectEngine({
					checkDir() {},
					registryKeys: [ 'foo' ]
				});
			}).to.throw(TypeError, 'Expected "registryKeys" option to be an object or array of objects with a "hive", "key", and "name"');
		});

		it('should reject if registryKeys is an array with object missing a hive', () => {
			expect(() => {
				new DetectEngine({
					checkDir() {},
					registryKeys: [ { foo: 'bar' } ]
				});
			}).to.throw(TypeError, 'Expected "registryKeys" option to be an object or array of objects with a "hive", "key", and "name"');
		});

		it('should reject if registryKeys is an array with object missing a key', () => {
			expect(() => {
				new DetectEngine({
					checkDir() {},
					registryKeys: [ { hive: 'HKLM' } ]
				});
			}).to.throw(TypeError, 'Expected "registryKeys" option to be an object or array of objects with a "hive", "key", and "name"');
		});

		it('should reject if registryKeys is an array with object missing a name', () => {
			expect(() => {
				new DetectEngine({
					checkDir() {},
					registryKeys: [ { hive: 'HKLM', key: 'foo' } ]
				});
			}).to.throw(TypeError, 'Expected "registryKeys" option to be an object or array of objects with a "hive", "key", and "name"');
		});

		it('should reject if registryKeys is an object missing a hive', () => {
			expect(() => {
				new DetectEngine({
					checkDir() {},
					registryKeys: { foo: 'bar' }
				});
			}).to.throw(TypeError, 'Expected "registryKeys" option to be an object or array of objects with a "hive", "key", and "name"');
		});

		it('should reject if registryKeys is an object missing a key', () => {
			expect(() => {
				new DetectEngine({
					checkDir() {},
					registryKeys: { hive: 'HKLM' }
				});
			}).to.throw(TypeError, 'Expected "registryKeys" option to be an object or array of objects with a "hive", "key", and "name"');
		});

		it('should reject if registryKeys is an object missing a name', () => {
			expect(() => {
				new DetectEngine({
					checkDir() {},
					registryKeys: { hive: 'HKLM', key: 'foo' }
				});
			}).to.throw(TypeError, 'Expected "registryKeys" option to be an object or array of objects with a "hive", "key", and "name"');
		});
	});

	describe('Detect', () => {
		afterEach(async function () {
			if (this.engine) {
				await this.engine.stop();
			}
		});

		it('should do nothing if there are no paths to scan', async function () {
			this.engine = new DetectEngine({
				checkDir() {}
			});
			const results = await this.engine.start();
			expect(results).to.be.undefined;
		});

		it('should get a single object for the result', async function () {
			this.engine = new DetectEngine({
				checkDir() {
					return { foo: 'bar' };
				},
				paths: __dirname,
			});

			const results = await this.engine.start();
			expect(results).to.deep.equal({ foo: 'bar' });
		});

		it('should call detect function for each path', async function () {
			this.engine = new DetectEngine({
				checkDir(dir) {
					expect(dir).to.equal(__dirname);
					return { foo: 'bar' };
				},
				multiple: true,
				paths: __dirname
			});

			const results = await this.engine.start();
			expect(results).to.be.an('array');
			expect(results).to.deep.equal([ { foo: 'bar' } ]);
		});

		it('should handle a path that does not exist', async function () {
			const p = path.join(__dirname, 'doesnotexist');

			this.engine = new DetectEngine({
				checkDir(dir) {
					expect(dir).to.equal(p);
				},
				multiple: true,
				paths: p
			});

			const results = await this.engine.start();
			expect(results).to.be.an('array');
			expect(results).to.have.lengthOf(0);
		});

		it('should scan subdirectories if detect function returns falsey result', async function () {
			const m = __dirname;
			const p = path.join(__dirname, 'mocks');

			this.engine = new DetectEngine({
				checkDir(dir) {
					if (dir === p) {
						return { foo: 'bar' };
					}
				},
				depth: 1,
				multiple: true,
				paths: m
			});

			const results = await this.engine.start();
			expect(results).to.be.an('array');
			expect(results).to.deep.equal([ { foo: 'bar' } ]);
		});

		it('should return multiple results', async function () {
			this.engine = new DetectEngine({
				checkDir() {
					return [
						{ foo: 'bar' },
						{ baz: 'wiz' }
					];
				},
				multiple: true,
				paths: __dirname
			});

			const results = await this.engine.start();
			expect(results).to.be.an('array');
			expect(results).to.deep.equal([
				{ foo: 'bar' },
				{ baz: 'wiz' }
			]);
		});

		it('should call processResults before returning', async function () {
			this.engine = new DetectEngine({
				checkDir() {
					return { foo: 'bar' };
				},
				paths: __dirname,
				processResults(results) {
					expect(results).to.deep.equal([ { foo: 'bar' } ]);
					return { baz: 'wiz' };
				}
			});

			const results = await this.engine.start();
			expect(results).to.be.an('object');
			expect(results).to.deep.equal({ baz: 'wiz' });
		});
	});

	describe('Watch', () => {
		beforeEach(() => {
			log('** STARTING TEST **********************************************');
		});

		afterEach(async function () {
			if (this.engine) {
				await this.engine.stop();
			}
		});

		it('should watch a path for changes', function (done) {
			this.timeout(5000);
			this.slow(4000);

			let counter = 0;
			const tmp = makeTempDir();

			this.engine = new DetectEngine({
				checkDir() {
					if (++counter === 1) {
						return null;
					}
					return { foo: 'bar' };
				},
				paths: tmp,
				watch: true
			});

			this.engine.on('results', results => {
				try {
					if (counter === 1) {
						throw new Error('Expected results to be emitted only if result is not null');
					} else if (counter > 1) {
						expect(results).to.deep.equal({ foo: 'bar' });
						done();
					}
				} catch (e) {
					done(e);
				}
			});

			this.engine.start()
				.then(results => {
					expect(results).to.be.undefined;

					const stats = status();
					delete stats.tree;
					log(stats);
					expect(stats.watchers).to.equal(1);

					setTimeout(() => {
						const file = path.join(tmp, 'foo.txt');
						log(`Writing ${highlight(file)}`);
						fs.writeFileSync(file, 'bar');
					}, 250);
				})
				.catch(done);
		});

		it('should watch for updates in a detected path', function (done) {
			this.timeout(5000);
			this.slow(4000);

			const tmp = makeTempDir();
			const testFile = path.join(tmp, 'test.txt');
			fs.writeFileSync(testFile, 'foo');

			let updated = false;

			this.engine = new DetectEngine({
				checkDir(dir) {
					const file = path.join(dir, 'test.txt');
					if (isFile(file)) {
						return { contents: fs.readFileSync(file).toString() };
					}
				},
				paths: tmp,
				redetect: true,
				watch: true
			});

			this.engine.on('results', results => {
				try {
					if (!updated) {
						expect(results).to.deep.equal({ contents: 'foo' });
					} else {
						expect(results).to.deep.equal({ contents: 'bar' });
						done();
					}
				} catch (e) {
					done(e);
				}
			});

			this.engine.start()
				.then(() => setTimeout(() => {
					// update the test file to trigger re-detection
					log('Writing bar');
					updated = true;
					fs.writeFileSync(testFile, 'bar');
				}, 100))
				.catch(done);
		});

		it('should recursivly watch for updates in a detected path', function (done) {
			this.timeout(5000);
			this.slow(4000);

			let counter = 0;
			const tmp = makeTempDir();
			const realDir = real(tmp);
			const subdir = path.join(tmp, 'test');
			fs.mkdirSync(subdir);
			const testFile = path.join(subdir, 'test.txt');
			fs.writeFileSync(testFile, 'foo');

			this.engine = new DetectEngine({
				checkDir(dir) {
					if (dir === realDir) {
						const file = path.join(dir, 'test', 'test.txt');
						if (isFile(file)) {
							return { contents: fs.readFileSync(file).toString() };
						}
					}
				},
				paths: tmp,
				recursive: true,
				redetect: true,
				watch: true
			});

			this.engine.on('results', results => {
				log('Got results:', results);
				try {
					counter++;
					if (counter === 1) {
						expect(results).to.deep.equal({ contents: 'foo' });
					} else if (counter === 2) {
						expect(results).to.deep.equal({ contents: 'bar' });
						done();
					}
				} catch (e) {
					done(e);
				}
			});

			this.engine.start()
				.then(() => setTimeout(() => {
					// update the test file to trigger re-detection
					log(`Writing ${highlight(testFile)}`);
					fs.writeFileSync(testFile, 'bar');
				}, 100))
				.catch(done);
		});

		it('should redetect after initial detection', function (done) {
			this.timeout(5000);
			this.slow(4000);

			let checkDirCounter = 0;
			let resultsCounter = 0;
			const tmp = makeTempDir();

			this.engine = new DetectEngine({
				checkDir() {
					if (++checkDirCounter === 1) {
						return Promise.resolve()
							.then(() => gawk({ version: '1.0.0' }))
							.catch(() => {});
					}

					return Promise.resolve()
						.then(() => gawk({ version: '2.0.0' }))
						.catch(() => {});
				},
				depth: 1,
				multiple: true,
				paths: tmp,
				redetect: true,
				watch: true
			});

			this.engine.on('results', results => {
				log('Got results:', results);
				try {
					switch (++resultsCounter) {
						case 1:
							expect(results).to.deep.equal([ { version: '1.0.0' } ]);

							// trigger an update
							fs.writeFileSync(path.join(tmp, 'foo.txt'), 'bar');
							break;

						case 2:
							expect(results).to.deep.equal([ { version: '2.0.0' } ]);
							done();
							break;
					}
				} catch (e) {
					done(e);
				}
			});

			this.engine.start();
		});

		it('should watch a directory and wire up fs watchers for found items', function (done) {
			this.timeout(10000);
			this.slow(9000);

			const tmp = makeTempDir();
			const dir = path.join(tmp, 'foo');
			const realDir = real(dir);
			fs.mkdirsSync(dir);

			this.engine = new DetectEngine({
				checkDir(dir) {
					if (dir === realDir) {
						return {
							foo: 'bar'
						};
					}
				},
				depth: 1,
				multiple: true,
				paths: [ tmp ],
				redetect: true,
				watch: true
			});

			log('Before detect...');
			let stats = status();
			delete stats.tree;
			log(stats);
			expect(stats.watchers).to.equal(0);

			this.engine.on('results', results => {
				log('Emitted results:');
				log(results);
			});

			this.engine.start()
				.then(async (results) => {
					gawk.watch(results, obj => {
						log('Gawk watch results:');
						log(obj);
					});

					log('After ready...');
					let stats = status();
					delete stats.tree;
					log(stats);
					expect(stats.watchers).to.equal(2);

					await sleep(500);

					log(`Removing ${highlight(dir)}`);
					fs.removeSync(dir);

					await sleep(500);

					log('After removal...');
					log(stats = status());
					expect(stats.watchers).to.equal(1);

					await sleep(500);

					log(`Adding back ${highlight(dir)}`);
					fs.mkdirsSync(dir);

					await sleep(500);

					log(stats = status());
					expect(stats.watchers).to.equal(2);

					done();
				})
				.catch(done);
		});
	});
});
