import fs from 'fs-extra';
import path from 'path';
import PluginPath from '../dist/plugin-path';
import snooplogg from 'snooplogg';
import tmp from 'tmp';

import { real } from 'appcd-path';
import { renderTree } from 'appcd-fswatcher';
import { sleep } from 'appcd-util';

import {
	InvalidScheme,
	PluginScheme,
	PluginsDirScheme,
	NestedPluginsDirScheme
} from '../dist/schemes';

const { log } = snooplogg.config({ theme: 'detailed' })('test:appcd:plugin-path');
const { highlight, magenta } = snooplogg.styles;

const _tmpDir = tmp.dirSync({
	prefix: 'appcd-plugin-test-',
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

describe('Plugin Path', () => {
	after(async function () {
		if (this.pp) {
			await this.pp.destroy();
			this.pp = null;
		}
		fs.removeSync(tmpDir);
	});

	it('should error if plugin path is invalid', () => {
		expect(() => {
			new PluginPath();
		}).to.throw(TypeError, 'Expected plugin path to be a non-empty string');

		expect(() => {
			new PluginPath(null);
		}).to.throw(TypeError, 'Expected plugin path to be a non-empty string');

		expect(() => {
			new PluginPath('');
		}).to.throw(TypeError, 'Expected plugin path to be a non-empty string');

		expect(() => {
			new PluginPath(123);
		}).to.throw(TypeError, 'Expected plugin path to be a non-empty string');
	});

	it('should watch non-existent path to become a plugin', function (done) {
		this.timeout(10000);
		this.slow(9000);

		const tmp = makeTempName();

		this.pp = new PluginPath(tmp)
			.on('added', plugin => {
				try {
					expect(plugin.name).to.equal('good');
					done();
				} catch (e) {
					done(e);
				}
			});

		this.pp.detect();

		log(renderTree());

		setTimeout(() => {
			const good = path.join(__dirname, 'fixtures', 'good');
			log('Copying %s => %s', highlight(good), highlight(tmp));
			fs.copySync(good, tmp);
		}, 1000);
	});

	it('should watch existing file to become a plugin', function (done) {
		this.timeout(10000);
		this.slow(9000);

		const tmp = makeTempDir();
		const file = path.join(tmp, 'foo');

		log('Writing %s', highlight(file));
		fs.writeFileSync(file, 'foo!');

		this.pp = new PluginPath(file)
			.on('added', plugin => {
				try {
					expect(plugin.name).to.equal('good');
					done();
				} catch (e) {
					done(e);
				}
			});

		this.pp.detect();

		setTimeout(() => {
			log('Deleting %s', highlight(file));
			fs.unlinkSync(file);

			log(renderTree());

			const good = path.join(__dirname, 'fixtures', 'good');
			log('Copying %s => %s', highlight(good), highlight(file));
			fs.copySync(good, file);
		}, 1000);
	});

	it('should watch existing directory to become a plugin', function (done) {
		this.timeout(10000);
		this.slow(9000);

		const tmp = makeTempDir();
		this.pp = new PluginPath(tmp)
			.on('added', plugin => {
				try {
					expect(plugin.name).to.equal('good');
					done();
				} catch (e) {
					done(e);
				}
			});

		this.pp.detect();

		setTimeout(() => {
			const good = path.join(__dirname, 'fixtures', 'good');
			log('Copying %s => %s', highlight(good), highlight(tmp));
			fs.copySync(good, tmp);
		}, 1000);
	});

	it('should watch existing directory to become a directory of plugins', function (done) {
		this.timeout(10000);
		this.slow(9000);

		let counter = 0;
		const tmp = makeTempDir();

		this.pp = new PluginPath(tmp)
			.on('added', plugin => {
				try {
					switch (++counter) {
						case 1:
							expect(plugin.name).to.equal('good');
							break;
						case 2:
							expect(plugin.name).to.equal('good2');
							done();
							break;
					}
				} catch (e) {
					done(e);
				}
			});

		this.pp.detect();

		setTimeout(() => {
			const good = path.join(__dirname, 'fixtures', 'plugin-dir');
			log('Copying %s => %s', highlight(good), highlight(tmp));
			fs.copySync(good, tmp);
		}, 1000);
	});

	it('should watch existing directory to become a directory of directories of plugins', function (done) {
		this.timeout(10000);
		this.slow(9000);

		let counter = 0;
		const tmp = makeTempDir();
		this.pp = new PluginPath(tmp)
			.on('added', plugin => {
				try {
					switch (++counter) {
						case 1:
							expect(plugin.name).to.equal('good');
							expect(plugin.version).to.equal('1.0.0');
							break;
						case 2:
							expect(plugin.name).to.equal('good');
							expect(plugin.version).to.equal('1.1.0');
							break;
						case 3:
							expect(plugin.name).to.equal('good2');
							expect(plugin.version).to.equal('1.0.0');
							break;
						case 4:
							expect(plugin.name).to.equal('good2');
							expect(plugin.version).to.equal('1.1.0');
							done();
							break;
					}
				} catch (e) {
					done(e);
				}
			});

		this.pp.detect();

		setTimeout(() => {
			const good = path.join(__dirname, 'fixtures', 'nested-plugin-dir');
			log('Copying %s => %s', highlight(good), highlight(tmp));
			fs.copySync(good, tmp);
		}, 1000);
	});

	it('should run the path scheme gauntlet and survive', function (done) {
		this.timeout(30000);
		this.slow(29000);

		const tmp = makeTempName();
		log('Plugin directory will be %s', highlight(tmp));

		let counter = 0;

		this.pp = new PluginPath(tmp)
			.on('added', plugin => {
				counter++;
				log('%s Plugin added: %s', magenta(`[${counter}]`), highlight(`${plugin.name}@${plugin.version}`));
				try {
					switch (counter) {
						case 1:
						case 3:
						case 7:
						case 29:
							expect(plugin.name).to.equal('good');
							expect(plugin.version).to.equal('1.2.3');
							break;
						case 4:
						case 9:
							expect(plugin.name).to.equal('good2');
							expect(plugin.version).to.equal('2.3.4');
							break;
						case 11:
						case 21:
							expect(plugin.name).to.equal('good');
							expect(plugin.version).to.equal('1.0.0');
							break;
						case 12:
						case 22:
							expect(plugin.name).to.equal('good');
							expect(plugin.version).to.equal('1.1.0');
							break;
						case 13:
						case 23:
							expect(plugin.name).to.equal('good2');
							expect(plugin.version).to.equal('1.0.0');
							break;
						case 14:
						case 24:
							expect(plugin.name).to.equal('good2');
							expect(plugin.version).to.equal('1.1.0');
							break;
						case 15:
							expect(plugin.name).to.equal('good3');
							expect(plugin.version).to.equal('3.4.5');
							break;
						case 30:
							expect(plugin.name).to.equal('good2');
							expect(plugin.version).to.equal('1.2.3');
					}
				} catch (e) {
					done(e);
				}
			})
			.on('removed', plugin => {
				counter++;
				log('%s Plugin deleted: %s', magenta(`[${counter}]`), highlight(`${plugin.name}@${plugin.version}`));
				try {
					switch (counter) {
						case 2:
						case 5:
						case 8:
						case 31:
							expect(plugin.name).to.equal('good');
							expect(plugin.version).to.equal('1.2.3');
							break;
						case 6:
						case 10:
							expect(plugin.name).to.equal('good2');
							expect(plugin.version).to.equal('2.3.4');
							break;
						case 16:
						case 25:
							expect(plugin.name).to.equal('good');
							expect(plugin.version).to.equal('1.0.0');
							break;
						case 17:
						case 26:
							expect(plugin.name).to.equal('good');
							expect(plugin.version).to.equal('1.1.0');
							break;
						case 18:
						case 27:
							expect(plugin.name).to.equal('good2');
							expect(plugin.version).to.equal('1.0.0');
							break;
						case 19:
						case 28:
							expect(plugin.name).to.equal('good2');
							expect(plugin.version).to.equal('1.1.0');
							break;
						case 20:
							expect(plugin.name).to.equal('good3');
							expect(plugin.version).to.equal('3.4.5');
							break;
						case 32:
							expect(plugin.name).to.equal('good2');
							expect(plugin.version).to.equal('1.2.3');
					}
				} catch (e) {
					done(e);
				}
			});

		this.pp.detect();

		Promise.resolve()
			.then(() => sleep(1000))
			// 1
			.then(() => {
				expect(counter).to.equal(0);
				log(renderTree());
				expect(this.pp.scheme).to.be.instanceof(InvalidScheme);

				const src = path.join(__dirname, 'fixtures', 'good');
				const dest = tmp;
				log('%s Copying %s => %s', magenta(`[${counter}]`), highlight(src), highlight(dest));
				fs.mkdirsSync(dest);
				fs.copySync(src, dest);

				return sleep(1000);
			})
			// 2
			.then(() => {
				expect(counter).to.equal(1);
				log(renderTree());
				expect(Object.keys(this.pp.plugins)).to.have.lengthOf(1);
				expect(this.pp.scheme).to.be.instanceof(PluginScheme);

				log('%s Deleting %s', magenta(`[${counter}]`), highlight(tmp));
				fs.removeSync(tmp);

				return sleep(1000);
			})
			.then(() => {
				expect(counter).to.equal(2);
				log(renderTree());
				expect(Object.keys(this.pp.plugins)).to.have.lengthOf(0);
				expect(this.pp.scheme).to.be.instanceof(InvalidScheme);

				log('%s Creating directory: %s', magenta(`[${counter}]`), highlight(tmp));
				fs.mkdirsSync(tmp);

				return sleep(1000);
			})
			// 3
			.then(() => {
				expect(counter).to.equal(2);
				log(renderTree());
				expect(Object.keys(this.pp.plugins)).to.have.lengthOf(0);
				expect(this.pp.scheme).to.be.instanceof(InvalidScheme);

				const src = path.join(__dirname, 'fixtures', 'good');
				const dest = path.join(tmp, 'good');
				log('%s Copying %s => %s', magenta(`[${counter}]`), highlight(src), highlight(dest));
				fs.mkdirsSync(dest);
				fs.copySync(src, dest);

				return sleep(1000);
			})
			// 4
			.then(() => {
				expect(counter).to.equal(3);
				log(renderTree());
				expect(Object.keys(this.pp.plugins)).to.have.lengthOf(1);
				expect(this.pp.scheme).to.be.instanceof(PluginsDirScheme);

				const src = path.join(__dirname, 'fixtures', 'good2');
				const dest = path.join(tmp, 'good2');
				log('%s Copying %s => %s', magenta(`[${counter}]`), highlight(src), highlight(dest));
				fs.mkdirsSync(dest);
				fs.copySync(src, dest);

				return sleep(1000);
			})
			// 5
			.then(() => {
				expect(counter).to.equal(4);
				log(renderTree());
				expect(Object.keys(this.pp.plugins)).to.have.lengthOf(2);
				expect(this.pp.scheme).to.be.instanceof(PluginsDirScheme);

				const dest = path.join(tmp, 'good');
				log('%s Deleting %s', magenta(`[${counter}]`), highlight(dest));
				fs.removeSync(dest);

				return sleep(1000);
			})
			// 6
			.then(() => {
				expect(counter).to.equal(5);
				log(renderTree());
				expect(Object.keys(this.pp.plugins)).to.have.lengthOf(1);
				expect(this.pp.scheme).to.be.instanceof(PluginsDirScheme);

				const dest = path.join(tmp, 'good2');
				log('%s Deleting %s', magenta(`[${counter}]`), highlight(dest));
				fs.removeSync(dest);

				return sleep(1000);
			})
			// 7
			.then(() => {
				expect(counter).to.equal(6);
				log(renderTree());
				expect(Object.keys(this.pp.plugins)).to.have.lengthOf(0);
				expect(this.pp.scheme).to.be.instanceof(InvalidScheme);

				const src = path.join(__dirname, 'fixtures', 'good');
				const dest = path.join(tmp, 'good');
				log('%s Copying %s => %s', magenta(`[${counter}]`), highlight(src), highlight(dest));
				fs.mkdirsSync(dest);
				fs.copySync(src, dest);

				return sleep(1000);
			})
			// 8, 9
			.then(() => {
				expect(counter).to.equal(7);
				log(renderTree());
				expect(Object.keys(this.pp.plugins)).to.have.lengthOf(1);
				expect(this.pp.scheme).to.be.instanceof(PluginsDirScheme);

				const src = path.join(__dirname, 'fixtures', 'good2');
				const dest = tmp;
				log('%s Copying %s => %s', magenta(`[${counter}]`), highlight(src), highlight(dest));
				fs.mkdirsSync(dest);
				fs.copySync(src, dest);

				return sleep(1000);
			})
			// 10
			.then(() => {
				expect(counter).to.equal(9);
				log(renderTree());
				expect(Object.keys(this.pp.plugins)).to.have.lengthOf(1);
				expect(this.pp.scheme).to.be.instanceof(PluginScheme);

				log('%s Deleting %s', magenta(`[${counter}]`), highlight(tmp));
				fs.removeSync(tmp);

				return sleep(1000);
			})
			// 11, 12, 13, 14
			.then(() => {
				log(renderTree());
				expect(this.pp.scheme).to.be.instanceof(InvalidScheme);
				expect(Object.keys(this.pp.plugins)).to.have.lengthOf(0);

				const src = path.join(__dirname, 'fixtures', 'nested-plugin-dir');
				const dest = tmp;
				log('%s Copying %s => %s', magenta(`[${counter}]`), highlight(src), highlight(dest));
				fs.mkdirsSync(dest);
				fs.copySync(src, dest);

				return sleep(1000);
			})
			// 15
			.then(() => {
				log(renderTree());
				expect(this.pp.scheme).to.be.instanceof(NestedPluginsDirScheme);
				expect(Object.keys(this.pp.plugins)).to.have.lengthOf(4);

				const src = path.join(__dirname, 'fixtures', 'good3');
				const dest = path.join(tmp, 'good3', '3.4.5');
				log('%s Copying %s => %s', magenta(`[${counter}]`), highlight(src), highlight(dest));
				fs.mkdirsSync(dest);
				fs.copySync(src, dest);

				return sleep(1000);
			})
			// 16
			.then(() => {
				log(renderTree());
				expect(this.pp.scheme).to.be.instanceof(NestedPluginsDirScheme);
				expect(Object.keys(this.pp.plugins)).to.have.lengthOf(5);

				const dest = path.join(tmp, 'good', '1.0.0');
				log('%s Deleting %s', magenta(`[${counter}]`), highlight(dest));
				fs.removeSync(dest);

				return sleep(1000);
			})
			// 17, 18, 19, 20
			.then(() => {
				log(renderTree());
				expect(this.pp.scheme).to.be.instanceof(NestedPluginsDirScheme);
				expect(Object.keys(this.pp.plugins)).to.have.lengthOf(4);

				let dest = path.join(tmp, 'good', '1.1.0', 'package.json');
				log('%s Deleting %s', magenta(`[${counter}]`), highlight(dest));
				fs.removeSync(dest);

				dest = path.join(tmp, 'good2', '1.0.0', 'package.json');
				log('%s Deleting %s', magenta(`[${counter}]`), highlight(dest));
				fs.removeSync(dest);

				dest = path.join(tmp, 'good2', '1.1.0', 'package.json');
				log('%s Deleting %s', magenta(`[${counter}]`), highlight(dest));
				fs.removeSync(dest);

				dest = path.join(tmp, 'good3', '3.4.5', 'package.json');
				log('%s Deleting %s', magenta(`[${counter}]`), highlight(dest));
				fs.removeSync(dest);

				return sleep(1000);
			})
			.then(() => {
				log(renderTree());
				expect(this.pp.scheme).to.be.instanceof(InvalidScheme);
				expect(Object.keys(this.pp.plugins)).to.have.lengthOf(0);

				log('%s Deleting %s', magenta(`[${counter}]`), highlight(tmp));
				fs.removeSync(tmp);

				return sleep(1000);
			})
			// 21, 22, 23, 24
			.then(() => {
				log(renderTree());
				expect(this.pp.scheme).to.be.instanceof(InvalidScheme);
				expect(Object.keys(this.pp.plugins)).to.have.lengthOf(0);

				const src = path.join(__dirname, 'fixtures', 'nested-plugin-dir');
				const dest = tmp;
				log('%s Copying %s => %s', magenta(`[${counter}]`), highlight(src), highlight(dest));
				fs.mkdirsSync(dest);
				fs.copySync(src, dest);

				return sleep(1000);
			})
			// 25, 26, 27, 28
			.then(() => {
				log(renderTree());
				expect(this.pp.scheme).to.be.instanceof(NestedPluginsDirScheme);
				expect(Object.keys(this.pp.plugins)).to.have.lengthOf(4);

				log('%s Deleting %s', magenta(`[${counter}]`), highlight(tmp));
				fs.removeSync(tmp);

				return sleep(1000);
			})
			// 29, 30
			.then(() => {
				log(renderTree());
				expect(this.pp.scheme).to.be.instanceof(InvalidScheme);
				expect(Object.keys(this.pp.plugins)).to.have.lengthOf(0);

				const src = path.join(__dirname, 'fixtures', 'plugin-dir');
				const dest = tmp;
				log('%s Copying %s => %s', magenta(`[${counter}]`), highlight(src), highlight(dest));
				fs.mkdirsSync(dest);
				fs.copySync(src, dest);

				return sleep(1000);
			})
			// 31, 32
			.then(() => {
				log(renderTree());
				expect(this.pp.scheme).to.be.instanceof(PluginsDirScheme);
				expect(Object.keys(this.pp.plugins)).to.have.lengthOf(2);

				log('%s Deleting %s', magenta(`[${counter}]`), highlight(tmp));
				fs.removeSync(tmp);

				return sleep(1000);
			})
			.then(() => {
				log(renderTree());
				expect(this.pp.scheme).to.be.instanceof(InvalidScheme);
				done();
			})
			.catch(done);
	});

	it('should remove all plugins when destroyed', function (done) {
		this.timeout(10000);
		this.slow(9000);

		const tmp = makeTempDir();
		this.pp = new PluginPath(tmp)
			.on('removed', plugin => {
				try {
					expect(plugin.name).to.equal('good');
				} catch (e) {
					done(e);
				}
			});

		this.pp.detect();

		setTimeout(() => {
			const good = path.join(__dirname, 'fixtures', 'good');
			log('Copying %s => %s', highlight(good), highlight(tmp));
			fs.copySync(good, tmp);

			setTimeout(() => {
				log('Destroying plugin path instance');
				this.pp.destroy();
				expect(Object.keys(this.pp.plugins)).to.have.lengthOf(0);
				done();
			}, 1000);
		}, 1000);
	});

	it('should detect bad plugin and watch when plugin becomes valid', function (done) {
		this.timeout(10000);
		this.slow(9000);

		const tmp = makeTempDir();
		this.pp = new PluginPath(tmp)
			.on('added', plugin => {
				try {
					expect(plugin.name).to.equal('good');
					done();
				} catch (e) {
					done(e);
				}
			});

		this.pp.detect();

		setTimeout(() => {
			// 1. Write a bad plugin
			const pkgJsonFile = path.join(tmp, 'package.json');
			log('Writing bad %s', highlight(pkgJsonFile));
			fs.writeFileSync(pkgJsonFile, '{}');

			setTimeout(() => {
				// 2. Update bad plugin, but it is still bad
				log('Writing bad again %s', highlight(pkgJsonFile));
				fs.writeFileSync(pkgJsonFile, '{"name":""}');

				setTimeout(() => {
					try {
						expect(this.pp.scheme).to.be.instanceof(PluginScheme);
						expect(Object.keys(this.pp.plugins)).to.have.lengthOf(0);

						// 3. Write good plugin and redetect it
						const good = path.join(__dirname, 'fixtures', 'good');
						log('Copying %s => %s', highlight(good), highlight(tmp));
						fs.copySync(good, tmp);
					} catch (e) {
						done(e);
					}
				}, 1000);
			}, 1000);
		}, 1000);
	});
});
