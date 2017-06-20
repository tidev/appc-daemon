import fs from 'fs-extra';
import path from 'path';
import PluginPath from '../dist/plugin-path';
import snooplogg from 'snooplogg';
import tmp from 'tmp';

import { real } from 'appcd-path';
import { renderTree } from 'appcd-fswatcher';

const logger = snooplogg.config({ theme: 'standard' })('test:appcd:plugin-path');
const { log } = logger;
const { green, highlight } = snooplogg.styles;

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

describe('PluginPath', () => {
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
		log('Creating directory: %s', highlight(tmp));

		this.pp = new PluginPath(tmp)
			.on('added', plugin => {
				try {
					expect(plugin.name).to.equal('good');
					done();
				} catch (e) {
					done(e);
				}
			});

		log(renderTree());

		setTimeout(() => {
			const good = path.join(__dirname, 'fixtures', 'good');
			log('Copying %s => %s', highlight(good), highlight(tmp));
			fs.copySync(good, tmp);
		}, 1000);
	});

	it.only('should watch existing file to become a plugin', function (done) {
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

		setTimeout(() => {
			log('Deleting %s', highlight(file));
			fs.unlinkSync(file);

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
						// case 1:
						// 	expect(plugin.name).to.equal('good');
						// 	break;
						// case 2:
						// 	expect(plugin.name).to.equal('good2');
						case 4:
							done();
							break;
					}
				} catch (e) {
					done(e);
				}
			});

		setTimeout(() => {
			const good = path.join(__dirname, 'fixtures', 'plugin-dir2');
			log('Copying %s => %s', highlight(good), highlight(tmp));
			fs.copySync(good, tmp);
		}, 1000);
	});
});
