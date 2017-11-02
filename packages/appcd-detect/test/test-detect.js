import appcdLogger from 'appcd-logger';
import Detector from '../dist/detect';
import Dispatcher from 'appcd-dispatcher';
import fs from 'fs-extra';
import FSWatchManager, { renderTree, status } from 'appcd-fswatcher';
import gawk from 'gawk';
import path from 'path';
import tmp from 'tmp';

import { exe } from 'appcd-subprocess';
import { isFile } from 'appcd-fs';
import { real } from 'appcd-path';
import { sleep } from 'appcd-util';

const { log } = appcdLogger('test:appcd:detect');

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

describe('Detect', () => {
	before(function () {
		this.fsw = new FSWatchManager();
		Dispatcher.register('/appcd/fswatch', this.fsw.dispatcher);
	});

	after(function () {
		Dispatcher.unregister('/appcd/fswatch', this.fsw.dispatcher);
		this.fsw.shutdown();
		fs.removeSync(tmpDir);
	});

	beforeEach(function () {
		this.PATH = process.env.PATH;
	});

	afterEach(function () {
		process.env.PATH = this.PATH;
		delete process.env.DETECT_TEST_PATH;
		delete process.env.DETECT_TEST_PATH2;
	});

	describe('Validation', () => {
		it('should reject if checkDir is not a function', () => {
			expect(() => {
				new Detector({
					checkDir: 123
				});
			}).to.throw(TypeError, 'Expected "checkDir" option to be a function');
		});

		it('should reject if env is not a string', () => {
			expect(() => {
				new Detector({
					env: 123
				});
			}).to.throw(TypeError, 'Expected "env" option to be a string or an array of strings');
		});

		it('should reject if env is not an array of strings', () => {
			expect(() => {
				new Detector({
					env: [ 'foo', 123 ]
				});
			}).to.throw(TypeError, 'Expected "env" option to be a string or an array of strings');
		});

		it('should reject if exe is not a string', () => {
			expect(() => {
				new Detector({
					exe: 123
				});
			}).to.throw(TypeError, 'Expected "exe" option to be a non-empty string');
		});

		it('should reject if exe is an empty string', () => {
			expect(() => {
				new Detector({
					exe: ''
				});
			}).to.throw(TypeError, 'Expected "exe" option to be a non-empty string');
		});

		it('should reject if paths is not a string', () => {
			expect(() => {
				new Detector({
					paths: 123
				});
			}).to.throw(TypeError, 'Expected "paths" option to be a non-empty string or an array or set of non-empty strings');
		});

		it('should reject if paths is not an array of strings', () => {
			expect(() => {
				new Detector({
					paths: [ 'foo', 123 ]
				});
			}).to.throw(TypeError, 'Expected "paths" option to be a non-empty string or an array or set of non-empty strings');
		});

		it('should reject if processResults() is not a function', () => {
			expect(() => {
				new Detector({
					processResults: 123
				});
			}).to.throw(TypeError, 'Expected "processResults" option to be a function');
		});

		it('should reject if registryCallback is not a function', () => {
			expect(() => {
				new Detector({
					registryCallback: 123
				});
			}).to.throw(TypeError, 'Expected "registryCallback" option to be a function');
		});

		it('should reject if registryKeys is not a function or object', () => {
			expect(() => {
				new Detector({
					registryKeys: 'foo'
				});
			}).to.throw(TypeError, 'Expected "registryKeys" option to be an object or array of objects with a "hive", "key", and "name"');
		});

		it('should reject if registryKeys is an array with a non-object', () => {
			expect(() => {
				new Detector({
					registryKeys: [ 'foo' ]
				});
			}).to.throw(TypeError, 'Expected "registryKeys" option to be an object or array of objects with a "hive", "key", and "name"');
		});

		it('should reject if registryKeys is an array with object missing a hive', () => {
			expect(() => {
				new Detector({
					registryKeys: [ { foo: 'bar' } ]
				});
			}).to.throw(TypeError, 'Expected "registryKeys" option to be an object or array of objects with a "hive", "key", and "name"');
		});

		it('should reject if registryKeys is an array with object missing a key', () => {
			expect(() => {
				new Detector({
					registryKeys: [ { hive: 'HKLM' } ]
				});
			}).to.throw(TypeError, 'Expected "registryKeys" option to be an object or array of objects with a "hive", "key", and "name"');
		});

		it('should reject if registryKeys is an array with object missing a name', () => {
			expect(() => {
				new Detector({
					registryKeys: [ { hive: 'HKLM', key: 'foo' } ]
				});
			}).to.throw(TypeError, 'Expected "registryKeys" option to be an object or array of objects with a "hive", "key", and "name"');
		});

		it('should reject if registryKeys is an object missing a hive', () => {
			expect(() => {
				new Detector({
					registryKeys: { foo: 'bar' }
				});
			}).to.throw(TypeError, 'Expected "registryKeys" option to be an object or array of objects with a "hive", "key", and "name"');
		});

		it('should reject if registryKeys is an object missing a key', () => {
			expect(() => {
				new Detector({
					registryKeys: { hive: 'HKLM' }
				});
			}).to.throw(TypeError, 'Expected "registryKeys" option to be an object or array of objects with a "hive", "key", and "name"');
		});

		it('should reject if registryKeys is an object missing a name', () => {
			expect(() => {
				new Detector({
					registryKeys: { hive: 'HKLM', key: 'foo' }
				});
			}).to.throw(TypeError, 'Expected "registryKeys" option to be an object or array of objects with a "hive", "key", and "name"');
		});
	});

	describe('Scanning', () => {
		it('should do nothing if there are no paths to scan', async () => {
			const results = await new Detector().start();
			expect(results).to.be.undefined;
		});
	});

	/*
		afterEach(async function () {
			if (this.handle) {
				await this.handle.stop();
			}
		});

		it('should reject if paths is not a string', done => {
			const engine = new DetectEngine();
			engine.detect({ paths: 123 })
				.on('error', err => {
					try {
						expect(err).to.be.an.instanceof(TypeError);
						expect(err.message).to.equal('Expected paths to be a string or an array of strings');
						done();
					} catch (e) {
						done(e);
					}
				});
		});

		it('should reject if paths is not an array of strings', done => {
			const engine = new DetectEngine();
			engine.detect({ paths: [ 'foo', 123 ] })
				.on('error', err => {
					try {
						expect(err).to.be.an.instanceof(TypeError);
						expect(err.message).to.equal('Expected paths to be a string or an array of strings');
						done();
					} catch (e) {
						done(e);
					}
				});
		});

		it('should get a single object for the result', done => {
			const engine = new DetectEngine({
				checkDir(dir) {
					expect(dir).to.equal(__dirname);
					return { foo: 'bar' };
				}
			});

			engine
				.detect({
					paths: __dirname,
					// harmlessly enable redetect which will be disabled if watch is not enabled
					// this is more for code coverage
					redetect: true
				})
				.on('results', results => {
					expect(results).to.deep.equal({ foo: 'bar' });
					done();
				})
				.on('error', done);
		});

		it('should call detect function for each path', done => {
			const engine = new DetectEngine({
				checkDir(dir) {
					expect(dir).to.equal(__dirname);
					return { foo: 'bar' };
				},
				multiple: true
			});

			engine
				.detect({ paths: __dirname })
				.on('results', results => {
					expect(results).to.be.an('array');
					expect(results).to.deep.equal([ { foo: 'bar' } ]);
					done();
				})
				.on('error', done);
		});

		it('should return cache for non-forced second call', done => {
			let counter = 0;
			const engine = new DetectEngine({
				checkDir(dir) {
					expect(dir).to.equal(__dirname);
					counter++;
					return { foo: 'bar' };
				},
				multiple: true
			});

			engine
				.detect({ paths: __dirname })
				.on('results', results => {
					expect(results).to.be.an('array');
					expect(results).to.deep.equal([ { foo: 'bar' } ]);

					engine
						.detect({ paths: __dirname })
						.on('results', results => {
							expect(results).to.be.an('array');
							expect(results).to.deep.equal([ { foo: 'bar' } ]);
							expect(counter).to.equal(1);
							done();
						})
						.on('error', done);
				})
				.on('error', done);
		});

		it('should return cache for forced second call', done => {
			let counter = 0;
			const engine = new DetectEngine({
				checkDir(dir) {
					expect(dir).to.equal(__dirname);
					counter++;
					return { foo: 'bar' };
				},
				multiple: true
			});

			engine
				.detect({ paths: __dirname })
				.on('results', results => {
					expect(results).to.be.an('array');
					expect(results).to.deep.equal([ { foo: 'bar' } ]);

					engine
						.detect({ paths: __dirname, force: true })
						.on('results', results => {
							expect(results).to.be.an('array');
							expect(results).to.deep.equal([ { foo: 'bar' } ]);
							expect(counter).to.equal(2);
							done();
						})
						.on('error', done);
				})
				.on('error', done);
		});

		it('should handle a path that does not exist', done => {
			const p = path.join(__dirname, 'doesnotexist');
			const engine = new DetectEngine({
				checkDir(dir) {
					expect(dir).to.equal(p);
				},
				multiple: true
			});

			engine
				.detect({ paths: p })
				.on('results', results => {
					expect(results).to.be.an('array');
					expect(results).to.have.lengthOf(0);
					done();
				})
				.on('error', done);
		});

		it('should scan subdirectories if detect function returns falsey result', done => {
			const m = __dirname;
			const p = path.join(__dirname, 'mocks');
			const engine = new DetectEngine({
				checkDir(dir) {
					if (dir === p) {
						return { foo: 'bar' };
					}
				},
				depth: 1,
				multiple: true
			});

			engine
				.detect({ paths: m })
				.on('results', results => {
					expect(results).to.be.an('array');
					expect(results).to.deep.equal([ { foo: 'bar' } ]);
					done();
				})
				.on('error', done);
		});

		it('should return multiple results', done => {
			const engine = new DetectEngine({
				checkDir() {
					return [
						{ foo: 'bar' },
						{ baz: 'wiz' }
					];
				},
				multiple: true
			});

			engine
				.detect({ paths: __dirname })
				.on('results', results => {
					expect(results).to.be.an('array');
					expect(results).to.deep.equal([
						{ foo: 'bar' },
						{ baz: 'wiz' }
					]);
					done();
				})
				.on('error', done);
		});

		it('should update result after second call', done => {
			let counter = 0;
			const engine = new DetectEngine({
				checkDir(dir) {
					expect(dir).to.equal(__dirname);
					if (++counter === 1) {
						return { foo: 'bar' };
					}
					return { baz: 'wiz' };
				},
				multiple: true
			});

			engine
				.detect({ paths: __dirname })
				.on('results', results => {
					expect(results).to.be.an('array');
					expect(results).to.deep.equal([ { foo: 'bar' } ]);

					engine
						.detect({ paths: __dirname, force: true })
						.on('results', results => {
							expect(results).to.be.an('array');
							expect(results).to.deep.equal([ { baz: 'wiz' } ]);
							done();
						})
						.on('error', done);
				})
				.on('error', done);
		});

		it('should call processResults before returning', done => {
			const engine = new DetectEngine({
				checkDir(dir) {
					expect(dir).to.equal(__dirname);
					return { foo: 'bar' };
				},
				processResults(results) {
					expect(results).to.deep.equal({ foo: 'bar' });
					return { baz: 'wiz' };
				}
			});

			engine
				.detect({ paths: __dirname })
				.on('results', results => {
					expect(results).to.deep.equal({ baz: 'wiz' });
					done();
				})
				.on('error', done);
		});

		it('should queue up multiple calls', function (done) {
			this.timeout(5000);
			this.slow(4000);

			let counter = 0;
			const engine = new DetectEngine({
				async processResults() {
					await sleep(++counter === 1 ? 500 : 50);
				}
			});

			let finishCounter = 0;
			let finishErr;
			function finish(err) {
				err && (finishErr = err);
				if (++finishCounter === 2) {
					done(finishErr);
				}
			}

			engine
				.detect({ paths: __dirname })
				.on('results', () => {
					expect(counter).to.equal(1);
					finish();
				})
				.on('error', finish);

			setTimeout(() => {
				engine
					.detect({ paths: __dirname })
					.on('results', () => {
						expect(counter).to.equal(2);
						finish();
					})
					.on('error', finish);
			}, 100);
		});
	});

	describe('watch', () => {
		afterEach(async function () {
			if (this.handle) {
				await this.handle.stop();
			}
		});

		it('should watch a path for changes', function (done) {
			this.timeout(5000);
			this.slow(4000);

			let counter = 0;
			const tmp = makeTempDir();
			const engine = new DetectEngine({
				checkDir() {
					if (++counter === 1) {
						return null;
					}
					return { foo: 'bar' };
				}
			});

			this.handle = engine
				.detect({ paths: tmp, watch: true })
				.on('results', results => {
					this.handle.stop();
					if (counter === 1) {
						done(new Error('Expected results to be emitted only if result is not null'));
					} else if (counter > 1) {
						expect(results).to.deep.equal({ foo: 'bar' });
						done();
					}
				})
				.on('error', done);

			setTimeout(() => {
				fs.writeFileSync(path.join(tmp, 'foo.txt'), 'bar');
			}, 250);
		});

		it('should watch for updates in a detected path', function (done) {
			this.timeout(5000);
			this.slow(4000);

			const tmp = makeTempDir();
			const testFile = path.join(tmp, 'test.txt');
			fs.writeFileSync(testFile, 'foo');

			let updated = false;

			const engine = new DetectEngine({
				checkDir(dir) {
					const file = path.join(dir, 'test.txt');
					if (isFile(file)) {
						return { contents: fs.readFileSync(file).toString() };
					}
				}
			});

			this.handle = engine
				.detect({ paths: tmp, watch: true, redetect: true })
				.on('results', results => {
					console.log(results);
					if (!updated) {
						expect(results).to.deep.equal({ contents: 'foo' });
					} else {
						expect(results).to.deep.equal({ contents: 'bar' });
						this.handle.stop();
						done();
					}
				})
				.on('error', done);

			setTimeout(() => {
				// update the test file to trigger re-detection
				console.log('Writing bar');
				updated = true;
				fs.writeFileSync(testFile, 'bar');
			}, 1000);
		});

		it('should recursivly watch for updates in a detected path', function (done) {
			this.timeout(5000);
			this.slow(4000);

			let counter = 0;
			const tmp = makeTempDir();
			const subdir = path.join(tmp, 'test');
			fs.mkdirSync(subdir);
			const testFile = path.join(subdir, 'test.txt');
			fs.writeFileSync(testFile, 'foo');

			const engine = new DetectEngine({
				checkDir(dir) {
					const file = path.join(dir, 'test', 'test.txt');
					if (isFile(file)) {
						return { contents: fs.readFileSync(file).toString() };
					}
				}
			});

			this.handle = engine
				.detect({ paths: tmp, watch: true, recursive: true, redetect: true })
				.on('results', results => {
					counter++;
					if (counter === 1) {
						expect(results).to.deep.equal({ contents: 'foo' });
					} else if (counter === 2) {
						expect(results).to.deep.equal({ contents: 'bar' });
						this.handle.stop();
						done();
					}
				})
				.on('error', done);

			setTimeout(() => {
				// update the test file to trigger re-detection
				fs.writeFileSync(testFile, 'bar');
			}, 1000);
		});

		it('should redetect after initial detection', function (done) {
			this.timeout(5000);
			this.slow(4000);

			let checkDirCounter = 0;
			let resultsCounter = 0;
			const tmp = makeTempDir();

			const engine = new DetectEngine({
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
				multiple: true
			});

			this.handle = engine
				.detect({ paths: tmp, watch: true, redetect: true })
				.on('results', results => {
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
				});
		});

		it.only('should watch a directory and wire up fs watchers for found items', function (done) {
			this.timeout(10000);
			this.slow(9000);

			const tmp = makeTempDir();
			const dir = path.join(tmp, 'foo');
			fs.mkdirsSync(dir);
			let counter = 0;

			const engine = new DetectEngine({
				checkDir(dir) {
					counter++;
					console.log(counter, dir);
					switch (counter) {
						case 2:
						case 5:
							return {
								foo: 'bar'
							};
					}
				},
				depth: 1,
				multiple: true,
				paths: [ tmp ]
			});

			log('Before detect...');
			log(renderTree());
			let stats = status();
			log(stats);
			expect(stats.watchers).to.equal(0);

			this.handle = engine.detect({ watch: true, redetect: true });

			this.handle.on('results', results => {
				log('Emitted results:');
				log(results);
			});

			this.handle.on('ready', async (results) => {
				try {
					gawk.watch(results, obj => {
						log('Gawk watch results:');
						log(obj);
					});

					log('After ready...');
					log(renderTree());
					let stats = status();
					log(stats);
					expect(stats.watchers).to.equal(2);

					await sleep(500);

					log(`Removing ${dir}`);
					fs.removeSync(dir);

					await sleep(500);

					log('After removal...');
					log(renderTree());
					log(stats = status());
					expect(stats.watchers).to.equal(1);

					await sleep(500);

					log('Adding back dir');
					fs.mkdirsSync(dir);

					await sleep(500);

					log(renderTree());
					log(stats = status());
					expect(stats.watchers).to.equal(2);

					done();
				} catch (e) {
					done(e);
				}
			});
		});
	});
	*/
});
