import del from 'del';
import fs from 'fs-extra';
import FSWatcher, { reset } from '../src/fswatcher';
import path from 'path';
import snooplogg from 'snooplogg';
import tmp from 'tmp';

const log = snooplogg.config({ theme: 'detailed' })('test:appcd:fswatcher').log;

tmp.setGracefulCleanup();

function makeTempName() {
	return tmp.tmpNameSync({
		prefix: 'appcd-fswatcher-test-'
	});
}

function makeTempDir() {
	return fs.realpathSync(tmp.dirSync({
		prefix: 'appcd-fswatcher-test-',
		unsafeCleanup: true
	}).name);
}

describe('FSWatcher', () => {
	beforeEach(function () {
		this.pathsToCleanup = [];
	});
	afterEach(function (done) {
		reset();
		del(this.pathsToCleanup, { force: true }).then(() => done()).catch(done);
	});

	it('should throw error if path is not a string', () => {
		expect(() => {
			new FSWatcher();
		}).to.throw(TypeError, 'Expected path to be a string');

		expect(() => {
			new FSWatcher(123);
		}).to.throw(TypeError, 'Expected path to be a string');

		expect(() => {
			new FSWatcher(function () {});
		}).to.throw(TypeError, 'Expected path to be a string');
	});

	it('should throw error if options is not an object', () => {
		expect(() => {
			new FSWatcher('foo', 'bar');
		}).to.throw(TypeError, 'Expected options to be an object');

		expect(() => {
			new FSWatcher('foo', 123);
		}).to.throw(TypeError, 'Expected options to be an object');
	});

	it('should watch an existing directory for a new file', done => {
		const tmp = makeTempDir();
		const filename = path.join(tmp, 'foo.txt');

	 	new FSWatcher(tmp)
			.on('change', evt => {
				expect(evt).to.be.an.Object;
				expect(evt.action).to.equal('add');
				expect(evt.file).to.equal(filename);
				done();
			});

		fs.writeFileSync(filename, 'foo!');
	});

	it('should watch an existing directing for a new file that is changed', done => {
		const tmp = makeTempDir();
		const filename = path.join(tmp, 'foo.txt');
		let counter = 0;

		new FSWatcher(tmp)
			.on('change', evt => {
				counter++;
				if (counter === 1) {
					// adding the file
					expect(evt).to.be.an.Object;
					expect(evt.action).to.equal('add');
					expect(evt.file).to.equal(filename);
				} else if (counter === 2) {
					// updating the file
					expect(evt).to.be.an.Object;
					expect(evt.action).to.equal('change');
					expect(evt.file).to.equal(filename);
					done();
				}
			});

		fs.writeFileSync(filename, 'foo!');

		setTimeout(() => {
			fs.appendFileSync(filename, '\nbar!');
		}, 10);
	});

	it('should watch an existing file for a change', done => {
		const tmp = makeTempDir();
		const filename = path.join(tmp, 'foo.txt');
		fs.writeFileSync(filename, 'foo!');

		new FSWatcher(filename)
			.on('change', evt => {
				expect(evt).to.be.an.Object;
				expect(evt.action).to.equal('change');
				expect(evt.file).to.equal(filename);
				done();
			});

		setTimeout(() => {
			fs.appendFileSync(filename, '\nbar!');
		}, 10);
	});

	it.only('should watch a directory that does not exist', function (done) {
		const tmp = makeTempName();
		const filename = path.join(tmp, 'foo.txt');

		log(`Temp dir = ${tmp}`);

		new FSWatcher(tmp)
			.on('change', evt => {
				expect(evt).to.be.an.Object;
				expect(evt.action).to.equal('add');
				expect(evt.file).to.equal(filename);
				done();
			});

		// new FSWatcher('/Users/chris/Desktop');
		// new FSWatcher('/Users/chris/appc/workspace');

		setTimeout(() => {
			this.pathsToCleanup.push(tmp);
			fs.mkdirsSync(tmp);

			setTimeout(() => {
				log(`Writing ${filename}`);
				fs.writeFileSync(filename, 'foo!');
			}, 10);
		}, 10);
	});
/*
	it('should watch a file that does not exist', done => {
		const tmp = temp.mkdirSync('node-appc-test-');
		const filename = path.join(tmp, 'foo.txt');

		appc.fs.watch(filename, evt => {
			expect(evt).to.be.an.Object;
			expect(evt.action).to.equal('add');
			expect(evt.file).to.equal(filename);
			done();
		});

		setTimeout(() => {
			fs.writeFileSync(filename, 'foo!');
		}, 10);
	});

	it('should unwatch a directory', function (done) {
		this.timeout(10000);
		this.slow(5000);

		const tmp = temp.mkdirSync('node-appc-test-');
		const filename = path.join(tmp, 'foo.txt');
		const filename2 = path.join(tmp, 'bar.txt');
		let counter = 0;

		const unwatch = appc.fs.watch(tmp, evt => {
			if (++counter === 1) {
				expect(evt).to.be.an.Object;
				expect(evt.action).to.equal('add');
				expect(evt.file).to.equal(filename);
				unwatch();
				setTimeout(() => {
					fs.writeFileSync(filename2, 'bar!');
					setTimeout(() => {
						expect(appc.fs.rootWatcher.fswatcher).to.be.null;
						expect(appc.fs.rootWatcher.listeners).to.have.lengthOf(0);
						expect(appc.fs.rootWatcher.children).to.be.null;
						expect(appc.fs.rootWatcher.stat).to.be.null;
						expect(appc.fs.rootWatcher.files).to.be.null;
						done();
					}, 1000);
				}, 10);
			} else {
				done(new Error('Expected onChange to only fire once'));
			}
		});

		setTimeout(() => {
			fs.writeFileSync(filename, 'foo!');
		}, 10);
	});

	it('should unwatch a file', function (done) {
		this.timeout(10000);
		this.slow(5000);

		const tmp = temp.mkdirSync('node-appc-test-');
		const filename = path.join(tmp, 'foo.txt');
		let counter = 0;

		const unwatch = appc.fs.watch(filename, evt => {
			counter++;
			if (counter === 1) {
				expect(evt).to.be.an.Object;
				expect(evt.action).to.equal('add');
				expect(evt.file).to.equal(filename);
				setTimeout(() => {
					fs.appendFileSync(filename, '\nbar!');
				}, 10);
			} else if (counter === 2) {
				expect(evt).to.be.an.Object;
				expect(evt.action).to.equal('change');
				expect(evt.file).to.equal(filename);
				unwatch();
				setTimeout(() => {
					fs.appendFileSync(filename, '\nbaz!');
					setTimeout(() => {
						expect(appc.fs.rootWatcher.fswatcher).to.be.null;
						expect(appc.fs.rootWatcher.listeners).to.have.lengthOf(0);
						expect(appc.fs.rootWatcher.children).to.be.null;
						expect(appc.fs.rootWatcher.stat).to.be.null;
						expect(appc.fs.rootWatcher.files).to.be.null;
						done();
					}, 1000);
				}, 10);
			} else {
				done(new Error('Expected onChange to only fire once'));
			}
		});

		setTimeout(() => {
			fs.writeFileSync(filename, 'foo!');
		}, 100);
	});

	it('should watch a directory that is deleted and recreated', function (done) {
		const tmp = temp.path('node-appc-test-');
		const fooDir = path.join(tmp, 'foo');
		const barFile = path.join(fooDir, 'bar.txt');
		let counter = 0;

		this.pathsToCleanup.push(tmp);
		fs.mkdirsSync(fooDir);

		appc.fs.watch(fooDir, evt => {
			expect(evt).to.be.an.Object;

			if (evt.action === 'add') {
				expect(evt.file).to.equal(barFile);

				counter++;
				if (counter === 1) {
					del([ tmp ], { force: true });
				} else if (counter === 2) {
					done();
				}
			} else if (evt.action === 'delete') {
				expect(evt.file).to.equal(barFile);

				setTimeout(() => {
					fs.mkdirsSync(fooDir);
					fs.writeFileSync(barFile, 'bar again!');
				}, 100);
			}
		});

		fs.writeFileSync(barFile, 'bar!');
	});

	it('should watch a file that is deleted and recreated', function (done) {
		this.timeout(10000);
		this.slow(5000);

		const tmp = temp.mkdirSync('node-appc-test-');
		const filename = path.join(tmp, 'foo.txt');
		fs.writeFileSync(filename, 'foo!');
		let counter = 0;

		appc.fs.watch(filename, evt => {
			counter++;

			try {
				if (counter === 1) {
					expect(evt).to.be.an.Object;
					expect(evt.action).to.equal('change');
					expect(evt.file).to.equal(filename);

					fs.unlinkSync(filename);

				} else if (counter === 2) {
					expect(evt).to.be.an.Object;
					expect(evt.action).to.equal('delete');
					expect(evt.file).to.equal(filename);

					setTimeout(() => {
						fs.writeFileSync(filename, 'bar again!');
					}, 100);

				} else if (counter === 3) {
					expect(evt).to.be.an.Object;
					expect(evt.action).to.equal('add');
					expect(evt.file).to.equal(filename);
					done();
				}
			} catch (e) {
				done(e);
			}
		});

		fs.appendFileSync(filename, '\nbar!');
	});

	it('should have two watchers watching the same directory and unwatch them', done => {
		const tmp = temp.mkdirSync('node-appc-test-');
		const filename = path.join(tmp, 'foo.txt');
		let counter = 0;

		const unwatch1 = appc.fs.watch(tmp, evt => {
			expect(evt).to.be.an.Object;
			expect(evt.action).to.equal('add');
			expect(evt.file).to.equal(filename);
			unwatch();
		});

		const unwatch2 = appc.fs.watch(tmp, evt => {
			expect(evt).to.be.an.Object;
			expect(evt.action).to.equal('add');
			expect(evt.file).to.equal(filename);
			unwatch();
		});

		function unwatch() {
			if (++counter === 2) {
				expect(appc.fs.rootWatcher.fswatcher).to.be.an.Object;
				expect(appc.fs.rootWatcher.listeners).to.have.lengthOf(0);
				expect(appc.fs.rootWatcher.children).to.be.an.Object;
				expect(Object.keys(appc.fs.rootWatcher.children).length).to.be.gt(0);
				expect(appc.fs.rootWatcher.stat).to.be.an.Object;
				expect(appc.fs.rootWatcher.files).to.be.an.Object;
				expect(Object.keys(appc.fs.rootWatcher.files).length).to.be.gt(0);

				unwatch1();

				expect(appc.fs.rootWatcher.fswatcher).to.be.an.Object;
				expect(appc.fs.rootWatcher.listeners).to.have.lengthOf(0);
				expect(appc.fs.rootWatcher.children).to.be.an.Object;
				expect(Object.keys(appc.fs.rootWatcher.children).length).to.be.gt(0);
				expect(appc.fs.rootWatcher.stat).to.be.an.Object;
				expect(appc.fs.rootWatcher.files).to.be.an.Object;
				expect(Object.keys(appc.fs.rootWatcher.files).length).to.be.gt(0);

				unwatch2();

				expect(appc.fs.rootWatcher.fswatcher).to.be.null;
				expect(appc.fs.rootWatcher.listeners).to.have.lengthOf(0);
				expect(appc.fs.rootWatcher.children).to.be.null;
				expect(appc.fs.rootWatcher.stat).to.be.null;
				expect(appc.fs.rootWatcher.files).to.be.null;

				done();
			}
		}

		fs.writeFileSync(filename, 'foo!');
	});

	it('should close and re-watch a directory', function (done) {
		this.timeout(10000);
		this.slow(5000);

		const tmp = temp.mkdirSync('node-appc-test-');
		const filename = path.join(tmp, 'foo.txt');

		appc.fs.watch(tmp, evt => {
			done(new Error('First watcher was invoked'));
		});

		setTimeout(() => {
			appc.fs.closeAllWatchers();

			appc.fs.watch(tmp, evt => {
				expect(evt).to.be.an.Object;
				expect(evt.action).to.equal('add');
				expect(evt.file).to.equal(filename);
				done();
			});

			fs.writeFileSync(filename, 'foo!');
		}, 100);
	});

	it('should recursively watch for changes in existing nested directories', function (done) {
		this.timeout(10000);
		this.slow(5000);

		const tmp = temp.mkdirSync('node-appc-test-');
		const fooDir = path.join(tmp, 'foo');
		fs.mkdirSync(fooDir);

		const barDir = path.join(fooDir, 'bar');
		const filename = path.join(barDir, 'baz.txt');
		let count = 0;

		appc.fs.watch(tmp, { recursive: true }, evt => {
			count++;
			expect(evt).to.be.an.Object;

			if (count === 1 && evt.action === 'change' && evt.filename === 'foo') {
				// sometimes we get an echo of 'foo' being created above
				count--;
				return;
			}

			if (count === 1) {
				// "bar" added, write "baz.txt"
				expect(evt.action).to.equal('add');
				expect(evt.file).to.equal(barDir);
				fs.writeFileSync(filename, 'foo!');

			} else if (count === 2) {
				// "baz.txt" added, delete "bar" directory
				expect(evt.action).to.equal('add');
				expect(evt.file).to.equal(filename);
				del([ barDir ], { force: true });

			} else if (count >= 3) {
				if (evt.action === 'change' && (evt.file === fooDir || evt.file === barDir)) {
					// just a notification that the timestamps have been updated
					count--;
					return;
				}

				// "bar" (and "baz.txt") deleted, verify watching has stopped
				expect(evt.action).to.equal('delete');
				if (evt.file === filename) {
					return;
				}
				expect(evt.file).to.equal(barDir);

				let watcher = appc.fs.rootWatcher;
				for (const segment of tmp.replace(path.resolve('/'), '').split(path.sep)) {
					watcher = watcher.children[segment];
					if (!watcher) {
						return done(new Error('Unable to find tmp dir watcher'));
					}
				}

				expect(watcher.files).to.be.an.Object;
				expect(watcher.files).to.have.property('foo');
				expect(watcher.children).to.be.an.Object;
				expect(watcher.children).to.have.property('foo');

				const fooWatcher = watcher.children['foo'];
				expect(fooWatcher.files).to.be.an.Object;
				expect(fooWatcher.files).to.be.empty;
				expect(fooWatcher.children).to.be.an.Object;
				expect(fooWatcher.children).to.be.empty;

				done();
			}
		});

		// create a subdirectory "bar" to kick off the watch
		fs.mkdirSync(barDir);
	});

	it('should recursively watch for changes in new nested directories', function (done) {
		this.timeout(10000);
		this.slow(5000);

		const tmp = temp.mkdirSync('node-appc-test-');
		const fooDir = path.join(tmp, 'foo');
		const barDir = path.join(fooDir, 'bar');
		const filename = path.join(barDir, 'baz.txt');
		let count = 0;

		appc.fs.watch(tmp, { recursive: true }, evt => {
			count++;
			expect(evt).to.be.an.Object;

			if (count === 1) {
				// "foo" added, add "bar" subdirectory
				expect(evt.action).to.equal('add');
				expect(evt.file).to.equal(fooDir);
				fs.mkdirSync(barDir);

			} else if (count === 2) {
				// "bar" added, write "baz.txt"
				expect(evt.action).to.equal('add');
				expect(evt.file).to.equal(barDir);
				fs.writeFileSync(filename, 'foo!');

			} else if (count === 3) {
				// "baz.txt" added, delete "bar" directory
				expect(evt.action).to.equal('add');
				expect(evt.file).to.equal(filename);
				del([ barDir ], { force: true });

			} else if (count >= 4) {
				if (evt.action === 'change' && (evt.file === fooDir || evt.file === barDir)) {
					// just a notification that the timestamps have been updated
					count--;
					return;
				}

				// "bar" (and "baz.txt") deleted, verify watching has stopped
				expect(evt.action).to.equal('delete');
				if (evt.file === filename) {
					return;
				}
				expect(evt.file).to.equal(barDir);

				let watcher = appc.fs.rootWatcher;
				for (const segment of tmp.replace(path.resolve('/'), '').split(path.sep)) {
					watcher = watcher.children[segment];
					if (!watcher) {
						return done(new Error('Unable to find tmp dir watcher'));
					}
				}

				expect(watcher.files).to.be.an.Object;
				expect(watcher.files).to.have.property('foo');
				expect(watcher.children).to.be.an.Object;
				expect(watcher.children).to.have.property('foo');

				const fooWatcher = watcher.children['foo'];
				expect(fooWatcher.files).to.be.an.Object;
				expect(fooWatcher.files).to.be.empty;
				expect(fooWatcher.children).to.be.an.Object;
				expect(fooWatcher.children).to.be.empty;

				done();
			}
		});

		// create a subdirectory "foo" to kick off the watch
		fs.mkdirSync(fooDir);
	});

	it('should recursively watch for changes in existing nested directories and ignore timestamps', function (done) {
		this.timeout(10000);
		this.slow(5000);

		const tmp = temp.mkdirSync('node-appc-test-');
		const fooDir = path.join(tmp, 'foo');
		fs.mkdirSync(fooDir);

		const barDir = path.join(fooDir, 'bar');
		const filename = path.join(barDir, 'baz.txt');
		let count = 0;

		appc.fs.watch(tmp, { ignoreDirectoryTimestampUpdates: true, recursive: true }, evt => {
			count++;
			expect(evt).to.be.an.Object;

			if (count === 1 && evt.action === 'change' && evt.filename === 'foo') {
				// sometimes we get an echo of 'foo' being created above
				count--;
				return;
			}

			if (count === 1) {
				// "bar" added, write "baz.txt"
				expect(evt.action).to.equal('add');
				expect(evt.file).to.equal(barDir);
				fs.writeFileSync(filename, 'foo!');

			} else if (count === 2) {
				// "baz.txt" added, delete "bar" directory
				expect(evt.action).to.equal('add');
				expect(evt.file).to.equal(filename);
				del([ barDir ], { force: true });

			} else if (count >= 3) {
				// "bar" (and "baz.txt") deleted, verify watching has stopped
				expect(evt.action).to.equal('delete');
				if (evt.file === filename) {
					return;
				}
				expect(evt.file).to.equal(barDir);

				let watcher = appc.fs.rootWatcher;
				for (const segment of tmp.replace(path.resolve('/'), '').split(path.sep)) {
					watcher = watcher.children[segment];
					if (!watcher) {
						return done(new Error('Unable to find tmp dir watcher'));
					}
				}

				expect(watcher.files).to.be.an.Object;
				expect(watcher.files).to.have.property('foo');
				expect(watcher.children).to.be.an.Object;
				expect(watcher.children).to.have.property('foo');

				const fooWatcher = watcher.children['foo'];
				expect(fooWatcher.files).to.be.an.Object;
				expect(fooWatcher.files).to.be.empty;
				expect(fooWatcher.children).to.be.an.Object;
				expect(fooWatcher.children).to.be.empty;

				done();
			}
		});

		// create a subdirectory "bar" to kick off the watch
		fs.mkdirSync(barDir);
	});

	SYMLINKS!
	*/
});
