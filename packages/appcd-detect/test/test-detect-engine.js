/* eslint-disable no-unused-vars, promise/no-callback-in-promise */

import appcdLogger from 'appcd-logger';
import DetectEngine from '../dist/index';
import Dispatcher from 'appcd-dispatcher';
import fs from 'fs-extra';
import FSWatchManager from 'appcd-fswatch-manager';
import gawk from 'gawk';
import path from 'path';
import tmp from 'tmp';

import { exe } from 'appcd-subprocess';
import { isFile } from 'appcd-fs';
import { real } from 'appcd-path';
import { sleep } from 'appcd-util';
import { spawnSync } from 'child_process';
import { status } from 'appcd-fswatcher';

const { log } = appcdLogger('test:appcd:detect');
const { highlight } = appcdLogger.styles;

const reg = (...args) => {
	log(`Executing: ${highlight(`reg ${args.join(' ')}`)}`);
	spawnSync('reg', args, { stdio: 'ignore' });
};

const isWindows = process.platform === 'win32';

const _tmpDir = tmp.dirSync({
	mode: '755',
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

		it('should ensure recursiveWatchDepth is a number', () => {
			const engine = new DetectEngine({
				checkDir() {},
				recursiveWatchDepth: '123'
			});
			expect(engine.opts.recursiveWatchDepth).to.equal(123);
		});

		it('should ensure recursiveWatchDepth is greater than or equal to zero', () => {
			const engine = new DetectEngine({
				checkDir() {},
				recursiveWatchDepth: -1
			});
			expect(engine.opts.recursiveWatchDepth).to.equal(0);
		});

		it('should disable redetect if not watching', () => {
			const engine = new DetectEngine({
				checkDir() {},
				redetect: true
			});
			expect(engine.opts.redetect).to.be.false;
		});

		it('should bake the name into the detect engine id', () => {
			const engine = new DetectEngine({
				checkDir() {},
				name: 'foo'
			});
			expect(engine.id).to.match(/^<foo:.+>$/);
		});
	});

	describe('Paths', () => {
		it('should find no paths to scan', async () => {
			const engine = new DetectEngine({
				checkDir() {}
			});

			const paths = await engine.getPaths();
			expect(paths.defaultPath).to.be.undefined;
			expect(Array.from(paths.searchPaths)).to.deep.equal([]);
		});

		it('should find path based on specified paths', async () => {
			const engine = new DetectEngine({
				checkDir() {},
				paths: [ __dirname ]
			});

			const paths = await engine.getPaths();
			expect(paths.defaultPath).to.equal(__dirname);
			expect(Array.from(paths.searchPaths)).to.deep.equal([ __dirname ]);
		});

		it('should find path based on exe', async () => {
			const mocksDir = path.join(__dirname, 'mocks');
			const engine = new DetectEngine({
				checkDir() {},
				envPath: mocksDir,
				exe: [ `test${exe}` ]
			});

			const paths = await engine.getPaths();
			expect(paths.defaultPath).to.equal(mocksDir);
			expect(Array.from(paths.searchPaths)).to.deep.equal([ mocksDir ]);
		});

		it('should find path based on relative exe', async () => {
			const engine = new DetectEngine({
				checkDir() {},
				envPath: path.join(__dirname, 'mocks'),
				exe: [ `../../test${exe}` ]
			});

			const paths = await engine.getPaths();
			expect(paths.defaultPath).to.equal(__dirname);
			expect(Array.from(paths.searchPaths)).to.deep.equal([ __dirname ]);
		});

		it('should find path based on environment variables', async () => {
			const fooDir = path.join(__dirname, 'foo');
			const barDir = path.join(__dirname, 'bar');

			process.env.APPCD_DETECT_TEST_FOO = fooDir;
			process.env.APPCD_DETECT_TEST_BAR = barDir;

			try {
				const engine = new DetectEngine({
					checkDir() {},
					env: [ 'APPCD_DETECT_TEST_FOO', 'APPCD_DETECT_TEST_BAR' ]
				});

				const paths = await engine.getPaths();
				expect(paths.defaultPath).to.equal(barDir);
				expect(Array.from(paths.searchPaths)).to.deep.equal([ fooDir, barDir ]);
			} finally {
				delete process.env.APPCD_DETECT_TEST_FOO;
				delete process.env.APPCD_DETECT_TEST_BAR;
			}
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

		it('should scan subdirectories for a single item', async function () {
			this.engine = new DetectEngine({
				checkDir(dir) {
					if (dir !== __dirname) {
						return { foo: 'bar' };
					}
				},
				depth: 1,
				paths: __dirname
			});

			const results = await this.engine.start();
			expect(results).to.deep.equal({ foo: 'bar' });
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

		it('should watch a path for changes', async function () {
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

			const promise = new Promise((resolve, reject) => {
				this.engine.on('results', results => {
					try {
						if (counter === 1) {
							throw new Error('Expected results to be emitted only if result is not null');
						} else if (counter > 1) {
							expect(results).to.deep.equal({ foo: 'bar' });
							resolve();
						}
					} catch (e) {
						reject(e);
					}
				});
			});

			const results = await this.engine.start();
			expect(results).to.be.undefined;

			const stats = status();
			delete stats.tree;
			log(stats);
			expect(stats.watchers).to.equal(1);

			await sleep(250);

			const file = path.join(tmp, 'foo.txt');
			log(`Writing ${highlight(file)}`);
			fs.writeFileSync(file, 'bar');

			return promise;
		});

		it('should watch for updates in a detected path', async function () {
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

			const promise = new Promise((resolve, reject) => {
				this.engine.on('results', results => {
					try {
						if (!updated) {
							expect(results).to.deep.equal({ contents: 'foo' });
						} else {
							expect(results).to.deep.equal({ contents: 'bar' });
							resolve();
						}
					} catch (e) {
						reject(e);
					}
				});
			});

			await this.engine.start();
			await sleep(100);

			// update the test file to trigger re-detection
			log('Writing bar');
			updated = true;
			fs.writeFileSync(testFile, 'bar');

			return promise;
		});

		it('should recursivly watch for updates in a detected path', async function () {
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

			const promise = new Promise((resolve, reject) => {
				this.engine.on('results', results => {
					log('Got results:', results);
					try {
						counter++;
						if (counter === 1) {
							expect(results).to.deep.equal({ contents: 'foo' });
						} else if (counter === 2) {
							expect(results).to.deep.equal({ contents: 'bar' });
							resolve();
						}
					} catch (e) {
						reject(e);
					}
				});
			});

			await this.engine.start();
			await sleep(100);

			// update the test file to trigger re-detection
			log(`Writing ${highlight(testFile)}`);
			fs.writeFileSync(testFile, 'bar');

			return promise;
		});

		it('should redetect after initial detection', async function () {
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

			const promise = new Promise((resolve, reject) => {
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
								resolve();
								break;
						}
					} catch (e) {
						reject(e);
					}
				});
			});

			await this.engine.start();

			return promise;
		});

		it('should watch a directory and wire up fs watchers for found items', async function () {
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

			const results = await this.engine.start();

			gawk.watch(results, obj => {
				log('Gawk watch results:');
				log(obj);
			});

			log('After ready...');
			stats = status();
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
		});

		it('should not detect something that was already recursively detected', async function () {
			this.timeout(10000);
			this.slow(9000);

			const tmp = makeTempDir();
			const fooDir = path.join(tmp, 'foo');
			const realFooDir = real(fooDir);
			fs.mkdirsSync(fooDir);

			this.engine = new DetectEngine({
				checkDir(dir) {
					if (dir === realFooDir) {
						return { foo: 'bar' };
					}
					return;
				},
				depth: 1,
				multiple: true,
				paths: [
					tmp,
					fooDir
				],
				redetect: true,
				watch: true
			});

			const results = await this.engine.start();
			expect(results).to.deep.equal([ { foo: 'bar' } ]);
		});
	});

	(isWindows ? describe : describe.skip)('Windows Registry', () => {
		describe('Validation', () => {
			it('should error if registryCallback() is not a function', () => {
				expect(() => {
					new DetectEngine({
						checkDir() {},
						registryCallback: 123
					});
				}).to.throw(TypeError, 'Expected "registryCallback" option to be a function');
			});

			it('should error if registryKeys is not a function or object', () => {
				expect(() => {
					new DetectEngine({
						checkDir() {},
						registryKeys: 'foo'
					});
				}).to.throw(TypeError, 'Expected registry watcher params to be an object');
			});

			it('should error if registryKeys is an array with a non-object', () => {
				expect(() => {
					new DetectEngine({
						checkDir() {},
						registryKeys: [ 'foo' ]
					});
				}).to.throw(TypeError, 'Expected registry watcher params to be an object');
			});

			it('should error if registryKeys has invalid key', () => {
				expect(() => {
					new DetectEngine({
						checkDir() {},
						registryKeys: [ { key: null } ]
					});
				}).to.throw(TypeError, 'Expected registry watcher "key" param to be a non-empty string');

				expect(() => {
					new DetectEngine({
						checkDir() {},
						registryKeys: [ { key: '' } ]
					});
				}).to.throw(TypeError, 'Expected registry watcher "key" param to be a non-empty string');
			});

			it('should error if registryKeys has invalid depth', () => {
				expect(() => {
					new DetectEngine({
						checkDir() {},
						registryKeys: [ { key: 'foo', depth: null } ]
					});
				}).to.throw(TypeError, 'Expected registry watcher "depth" param to be a positive integer');

				expect(() => {
					new DetectEngine({
						checkDir() {},
						registryKeys: [ { key: 'foo', depth: 'bar' } ]
					});
				}).to.throw(TypeError, 'Expected registry watcher "depth" param to be a positive integer');

				expect(() => {
					new DetectEngine({
						checkDir() {},
						registryKeys: [ { key: 'foo', depth: -123 } ]
					});
				}).to.throw(TypeError, 'Expected registry watcher "depth" param to be a positive integer');
			});

			it('should error if registryKeys has invalid value', () => {
				expect(() => {
					new DetectEngine({
						checkDir() {},
						registryKeys: [ { key: 'foo', value: null } ]
					});
				}).to.throw(TypeError, 'Expected registry watcher "value" param to be a non-empty string');

				expect(() => {
					new DetectEngine({
						checkDir() {},
						registryKeys: [ { key: 'foo', value: '' } ]
					});
				}).to.throw(TypeError, 'Expected registry watcher "value" param to be a non-empty string');

				expect(() => {
					new DetectEngine({
						checkDir() {},
						registryKeys: [ { key: 'foo', value: 123 } ]
					});
				}).to.throw(TypeError, 'Expected registry watcher "value" param to be a non-empty string');
			});

			it('should error if registryKeys has invalid hive', () => {
				expect(() => {
					new DetectEngine({
						checkDir() {},
						registryKeys: [ { key: 'foo', value: 'bar', hive: null } ]
					});
				}).to.throw(TypeError, 'Expected registry watcher "hive" param to be a non-empty string');

				expect(() => {
					new DetectEngine({
						checkDir() {},
						registryKeys: [ { key: 'foo', value: 'bar', hive: '' } ]
					});
				}).to.throw(TypeError, 'Expected registry watcher "hive" param to be a non-empty string');

				expect(() => {
					new DetectEngine({
						checkDir() {},
						registryKeys: [ { key: 'foo', value: 'bar', hive: true } ]
					});
				}).to.throw(TypeError, 'Expected registry watcher "hive" param to be a non-empty string');
			});

			it('should error if registryKeys has invalid filter', () => {
				expect(() => {
					new DetectEngine({
						checkDir() {},
						registryKeys: [ { key: 'foo', filter: 'baz' } ]
					});
				}).to.throw(TypeError, 'Expected registry watcher "filter" param to be an object');

				expect(() => {
					new DetectEngine({
						checkDir() {},
						registryKeys: [ { key: 'foo', filter: [] } ]
					});
				}).to.throw(TypeError, 'Expected registry watcher "filter" param to be an object');
			});

			it('should error if registryKeys has invalid filter values', () => {
				expect(() => {
					new DetectEngine({
						checkDir() {},
						registryKeys: [ { key: 'foo', filter: { values: null } } ]
					});
				}).to.throw(TypeError, 'Expected registry watcher "values" filter param to be a non-empty string or regex');

				expect(() => {
					new DetectEngine({
						checkDir() {},
						registryKeys: [ { key: 'foo', filter: { values: 123 } } ]
					});
				}).to.throw(TypeError, 'Expected registry watcher "values" filter param to be a non-empty string or regex');

				expect(() => {
					new DetectEngine({
						checkDir() {},
						registryKeys: [ { key: 'foo', filter: { values: '' } } ]
					});
				}).to.throw(TypeError, 'Expected registry watcher "values" filter param to be a non-empty string or regex');
			});

			it('should error if registryKeys has invalid filter subkeys', () => {
				expect(() => {
					new DetectEngine({
						checkDir() {},
						registryKeys: [ { key: 'foo', filter: { subkeys: null } } ]
					});
				}).to.throw(TypeError, 'Expected registry watcher "subkeys" filter param to be a non-empty string or regex');

				expect(() => {
					new DetectEngine({
						checkDir() {},
						registryKeys: [ { key: 'foo', filter: { subkeys: 123 } } ]
					});
				}).to.throw(TypeError, 'Expected registry watcher "subkeys" filter param to be a non-empty string or regex');

				expect(() => {
					new DetectEngine({
						checkDir() {},
						registryKeys: [ { key: 'foo', filter: { subkeys: '' } } ]
					});
				}).to.throw(TypeError, 'Expected registry watcher "subkeys" filter param to be a non-empty string or regex');
			});

			it('should error if registryKeys has key and invalid transform callback', () => {
				expect(() => {
					new DetectEngine({
						checkDir() {},
						registryKeys: [ { key: 'foo', value: 'bar', transform: null } ]
					});
				}).to.throw(TypeError, 'Expected registry watcher "transform" param to be a function');

				expect(() => {
					new DetectEngine({
						checkDir() {},
						registryKeys: [ { key: 'foo', value: 'bar', transform: 'baz' } ]
					});
				}).to.throw(TypeError, 'Expected registry watcher "transform" param to be a function');

				expect(() => {
					new DetectEngine({
						checkDir() {},
						registryKeys: [ { key: 'foo', value: 'bar', transform: 123 } ]
					});
				}).to.throw(TypeError, 'Expected registry watcher "transform" param to be a function');
			});
		});

		describe('Changes', () => {
			afterEach(async function () {
				if (this.engine) {
					await this.engine.stop();
					this.engine = null;
				}

				reg('delete', 'HKCU\\Software\\appcd-detect-test', '/f');
			});

			it('should watch existing key for changes (new subkey)', function (done) {
				this.timeout(10000);
				this.slow(10000);

				const dir = makeTempDir();
				let counter = 0;

				reg('delete', 'HKCU\\Software\\appcd-detect-test', '/f');
				reg('add', 'HKCU\\Software\\appcd-detect-test\\foo');

				this.engine = new DetectEngine({
					checkDir: async dir => {
						// log(`${counter + 1}: ${dir}`);

						switch (++counter) {
							case 2:
								done();
								break;
						}
					},
					paths: [ dir ],
					registryKeys: [
						{
							key: 'HKCU\\Software\\appcd-detect-test\\foo'
						}
					],
					watch: true
				});

				this.engine.start()
					.then(() => sleep(100))
					.then(() => reg('add', 'HKCU\\Software\\appcd-detect-test\\foo\\bar'))
					.catch(done);
			});

			it('should watch existing key that is deleted', function (done) {
				this.timeout(10000);
				this.slow(10000);

				const dir = makeTempDir();
				let counter = 0;

				reg('delete', 'HKCU\\Software\\appcd-detect-test', '/f');
				reg('add', 'HKCU\\Software\\appcd-detect-test\\foo');

				this.engine = new DetectEngine({
					checkDir: async dir => {
						// log(`${counter + 1}: ${dir}`);

						switch (++counter) {
							case 2:
								done();
								break;
						}
					},
					paths: [ dir ],
					registryKeys: [
						{
							key: 'HKCU\\Software\\appcd-detect-test\\foo'
						}
					],
					watch: true
				});

				this.engine.start()
					.then(() => sleep(100))
					.then(() => reg('delete', 'HKCU\\Software\\appcd-detect-test\\foo', '/f'))
					.catch(done);
			});

			it('should watch a non-existent key to be created', function (done) {
				this.timeout(10000);
				this.slow(10000);

				const dir = makeTempDir();
				let counter = 0;

				reg('delete', 'HKCU\\Software\\appcd-detect-test', '/f');
				reg('add', 'HKCU\\Software\\appcd-detect-test');

				this.engine = new DetectEngine({
					checkDir: async dir => {
						// log(`${counter + 1}: ${dir}`);

						switch (++counter) {
							case 2:
								done();
								break;
						}
					},
					paths: [ dir ],
					registryKeys: [
						{
							key: 'HKCU\\Software\\appcd-detect-test\\foo'
						}
					],
					watch: true
				});

				this.engine.start()
					.then(() => sleep(100))
					.then(() => reg('add', 'HKCU\\Software\\appcd-detect-test\\foo'))
					.catch(done);
			});

			it('should watch a subkey for changes', function (done) {
				this.timeout(10000);
				this.slow(10000);

				const dir = makeTempDir();
				let counter = 0;

				reg('delete', 'HKCU\\Software\\appcd-detect-test', '/f');
				reg('add', 'HKCU\\Software\\appcd-detect-test\\foo\\bar');

				this.engine = new DetectEngine({
					checkDir: async dir => {
						// log(`${counter + 1}: ${dir}`);

						switch (++counter) {
							case 2:
								done();
								break;
						}
					},
					paths: [ dir ],
					registryKeys: [
						{
							key: 'HKCU\\Software\\appcd-detect-test\\foo',
							depth: 1
						}
					],
					watch: true
				});

				this.engine.start()
					.then(() => sleep(100))
					.then(() => reg('add', 'HKCU\\Software\\appcd-detect-test\\foo\\bar\\baz'))
					.catch(done);
			});
		});

		describe('Values', () => {
			afterEach(async function () {
				if (this.engine) {
					await this.engine.stop();
					this.engine = null;
				}

				reg('delete', 'HKCU\\Software\\appcd-detect-test', '/f');
			});

			it('should get existing value', function (done) {
				this.timeout(10000);
				this.slow(10000);

				const dir1 = makeTempDir();
				const dir2 = makeTempDir();
				const dir3 = makeTempDir();
				let counter = 0;

				reg('delete', 'HKCU\\Software\\appcd-detect-test', '/f');
				reg('add', 'HKCU\\Software\\appcd-detect-test');
				reg('add', 'HKCU\\Software\\appcd-detect-test', '/v', 'foo', '/t', 'REG_SZ', '/d', dir2);

				this.engine = new DetectEngine({
					checkDir: async dir => {
						// log(`${counter + 1}: ${dir}`);

						try {
							switch (++counter) {
								case 2:
									expect(this.engine.paths).to.deep.equal([ dir1, dir2 ]);
									await sleep(250);
									reg('add', 'HKCU\\Software\\appcd-detect-test', '/v', 'foo', '/t', 'REG_SZ', '/d', dir3, '/f');
									break;

								case 4:
									expect(this.engine.paths).to.deep.equal([ dir1, dir3 ]);
									done();
									break;
							}
						} catch (err) {
							done(err);
						}
					},
					paths: [ dir1 ],
					registryKeys: [
						{
							key: 'HKCU\\Software\\appcd-detect-test',
							value: 'foo'
						}
					],
					watch: true
				});

				this.engine.start();
			});

			it('should get value once created', function (done) {
				this.timeout(10000);
				this.slow(10000);

				const dir1 = makeTempDir();
				const dir2 = makeTempDir();
				const dir3 = makeTempDir();
				let counter = 0;

				reg('delete', 'HKCU\\Software\\appcd-detect-test', '/f');
				reg('add', 'HKCU\\Software\\appcd-detect-test');

				this.engine = new DetectEngine({
					checkDir: async dir => {
						// log(`${counter + 1}: ${dir}`);

						try {
							switch (++counter) {
								case 1:
									expect(this.engine.paths).to.deep.equal([ dir1 ]);
									await sleep(250);
									reg('add', 'HKCU\\Software\\appcd-detect-test', '/v', 'foo', '/t', 'REG_SZ', '/d', dir2);
									break;

								case 3:
									expect(this.engine.paths).to.deep.equal([ dir1, dir2 ]);
									await sleep(250);
									reg('add', 'HKCU\\Software\\appcd-detect-test', '/v', 'foo', '/t', 'REG_SZ', '/d', dir3, '/f');
									break;

								case 5:
									expect(this.engine.paths).to.deep.equal([ dir1, dir3 ]);
									done();
									break;
							}
						} catch (err) {
							done(err);
						}
					},
					paths: [ dir1 ],
					registryKeys: [
						{
							key: 'HKCU\\Software\\appcd-detect-test',
							value: 'foo'
						}
					],
					watch: true
				});

				this.engine.start();
			});

			it('should get and transform existing value', function (done) {
				this.timeout(10000);
				this.slow(10000);

				const dir1 = makeTempDir();
				const dir2 = makeTempDir();
				const dir3 = makeTempDir();
				let counter = 0;

				reg('delete', 'HKCU\\Software\\appcd-detect-test', '/f');
				reg('add', 'HKCU\\Software\\appcd-detect-test');
				reg('add', 'HKCU\\Software\\appcd-detect-test', '/v', 'foo', '/t', 'REG_SZ', '/d', dir2);

				this.engine = new DetectEngine({
					checkDir: async dir => {
						// log(`${counter + 1}: ${dir}`);

						try {
							switch (++counter) {
								case 2:
									expect(this.engine.paths).to.deep.equal([ dir1, dir3 ]);
									done();
									break;
							}
						} catch (err) {
							done(err);
						}
					},
					paths: [ dir1 ],
					registryKeys: [
						{
							key: 'HKCU\\Software\\appcd-detect-test',
							transform(obj) {
								obj.value = dir3;
							},
							value: 'foo'
						}
					],
					watch: true
				});

				this.engine.start();
			});
		});

		describe('Filtering', () => {
			afterEach(async function () {
				if (this.engine) {
					await this.engine.stop();
					this.engine = null;
				}

				reg('delete', 'HKCU\\Software\\appcd-detect-test', '/f');
			});

			it('should filter out subkeys by string', function (done) {
				this.timeout(10000);
				this.slow(10000);

				const dir = makeTempDir();
				let counter = 0;
				let nogo = false;

				reg('delete', 'HKCU\\Software\\appcd-detect-test', '/f');
				reg('add', 'HKCU\\Software\\appcd-detect-test');

				this.engine = new DetectEngine({
					checkDir: dir => {
						// log(`${counter + 1}: ${dir}`);

						if (nogo) {
							done(new Error('Did not expect any events!'));
							return;
						}

						switch (++counter) {
							case 2:
								nogo = true;
								reg('add', 'HKCU\\Software\\appcd-detect-test\\bar');
								setTimeout(() => {
									nogo = false;
									reg('delete', 'HKCU\\Software\\appcd-detect-test\\foo', '/f');
								}, 1000);
								break;

							case 3:
								reg('add', 'HKCU\\Software\\appcd-detect-test\\foo');
								break;

							case 4:
								done();
								break;
						}
					},
					paths: [ dir ],
					registryKeys: [
						{
							key: 'HKCU\\Software\\appcd-detect-test',
							filter: {
								subkeys: 'foo'
							}
						}
					],
					watch: true
				});

				this.engine.start()
					.then(() => sleep(100))
					.then(() => reg('add', 'HKCU\\Software\\appcd-detect-test\\foo'))
					.catch(done);
			});

			it('should filter out subkeys by regex', function (done) {
				this.timeout(10000);
				this.slow(10000);

				const dir = makeTempDir();
				let counter = 0;
				let nogo = false;

				reg('delete', 'HKCU\\Software\\appcd-detect-test', '/f');
				reg('add', 'HKCU\\Software\\appcd-detect-test');

				this.engine = new DetectEngine({
					checkDir: dir => {
						// log(`${counter + 1}: ${dir}`);

						if (nogo) {
							done(new Error('Did not expect any events!'));
							return;
						}

						switch (++counter) {
							case 2:
								nogo = true;
								reg('add', 'HKCU\\Software\\appcd-detect-test\\bar');
								setTimeout(() => {
									nogo = false;
									reg('add', 'HKCU\\Software\\appcd-detect-test\\foo2');
								}, 1000);
								break;

							case 3:
								done();
								break;
						}
					},
					paths: [ dir ],
					registryKeys: [
						{
							key: 'HKCU\\Software\\appcd-detect-test',
							filter: {
								subkeys: /^foo/
							}
						}
					],
					watch: true
				});

				this.engine.start()
					.then(() => sleep(100))
					.then(() => reg('add', 'HKCU\\Software\\appcd-detect-test\\foo'))
					.catch(done);
			});

			it('should filter out values by string', function (done) {
				this.timeout(10000);
				this.slow(10000);

				const dir = makeTempDir();
				let counter = 0;
				let nogo = false;

				reg('delete', 'HKCU\\Software\\appcd-detect-test', '/f');
				reg('add', 'HKCU\\Software\\appcd-detect-test');

				this.engine = new DetectEngine({
					checkDir: dir => {
						// log(`${counter + 1}: ${dir}`);

						if (nogo) {
							done(new Error('Did not expect any events!'));
							return;
						}

						switch (++counter) {
							case 2:
								nogo = true;
								reg('add', 'HKCU\\Software\\appcd-detect-test', '/v', 'bar', '/t', 'REG_SZ', '/d', 'test2');
								setTimeout(() => {
									nogo = false;
									reg('delete', 'HKCU\\Software\\appcd-detect-test', '/v', 'foo', '/f');
								}, 1000);
								break;

							case 3:
								reg('add', 'HKCU\\Software\\appcd-detect-test', '/v', 'foo', '/t', 'REG_SZ', '/d', 'test3', '/f');
								break;

							case 4:
								done();
								break;
						}
					},
					paths: [ dir ],
					registryKeys: [
						{
							key: 'HKCU\\Software\\appcd-detect-test',
							filter: {
								values: 'foo'
							}
						}
					],
					watch: true
				});

				this.engine.start()
					.then(() => sleep(100))
					.then(() => reg('add', 'HKCU\\Software\\appcd-detect-test', '/v', 'foo', '/t', 'REG_SZ', '/d', 'test1'))
					.catch(done);
			});

			it('should filter out values by regex', function (done) {
				this.timeout(10000);
				this.slow(10000);

				const dir = makeTempDir();
				let counter = 0;
				let nogo = false;

				reg('delete', 'HKCU\\Software\\appcd-detect-test', '/f');
				reg('add', 'HKCU\\Software\\appcd-detect-test');

				this.engine = new DetectEngine({
					checkDir: dir => {
						// log(`${counter + 1}: ${dir}`);

						if (nogo) {
							done(new Error('Did not expect any events!'));
							return;
						}

						switch (++counter) {
							case 2:
								nogo = true;
								reg('add', 'HKCU\\Software\\appcd-detect-test', '/v', 'bar', '/t', 'REG_SZ', '/d', 'test2');
								setTimeout(() => {
									nogo = false;
									reg('delete', 'HKCU\\Software\\appcd-detect-test', '/v', 'foo', '/f');
								}, 1000);
								break;

							case 3:
								reg('add', 'HKCU\\Software\\appcd-detect-test', '/v', 'foo2', '/t', 'REG_SZ', '/d', 'test3', '/f');
								break;

							case 4:
								done();
								break;
						}
					},
					paths: [ dir ],
					registryKeys: [
						{
							key: 'HKCU\\Software\\appcd-detect-test',
							filter: {
								values: /^foo/
							}
						}
					],
					watch: true
				});

				this.engine.start()
					.then(() => sleep(100))
					.then(() => reg('add', 'HKCU\\Software\\appcd-detect-test', '/v', 'foo', '/t', 'REG_SZ', '/d', 'test1'))
					.catch(done);
			});
		});
	});
});

/*

filtering!!!!

WINDOWS

visual studio:

export const registryKeys = {
	'HKCU\\Software\\Microsoft\\VisualStudio':              {},
	'HKCU\\Software\\Microsoft\\VSCommon':                  {},
	'HKLM\\Software\\RegisteredApplications':               { values: /^VisualStudio.+/ },
	'HKLM\\Software\\Microsoft\\VisualStudio':              {},
	'HKLM\\Software\\WOW6432Node\\Microsoft':               { subkeys: /^VisualStudio.+/ },
	'HKLM\\Software\\WOW6432Node\\Microsoft\\VisualStudio': {}
};

registryKeys: Object.entries(windowslib.vs.registrykeys).map(([ key, filter ]) => ({ filter, key }))
*/
