import appcdLogger from 'appcd-logger';
import AppcdConfig from 'appcd-config';
import ConfigService from 'appcd-config-service';
import Dispatcher, { DispatcherError } from 'appcd-dispatcher';
import fs from 'fs-extra';
import FSWatchManager from 'appcd-fswatch-manager';
import path from 'path';
import PluginError from '../dist/plugin-error';
import PluginManager from '../dist/index';
import SubprocessManager from 'appcd-subprocess';
import tmp from 'tmp';

import { expandPath } from 'appcd-path';
import { PassThrough } from 'stream';
import { renderTree } from 'appcd-fswatcher';
import { sleep } from 'appcd-util';

const { log } = appcdLogger('test:appcd:plugin:manager');
const { highlight } = appcdLogger.styles;

const tmpDir = tmp.dirSync({
	mode: '755',
	prefix: 'appcd-plugin-test-',
	unsafeCleanup: true
}).name;

function makeTempDir() {
	const dir = path.join(tmpDir, Math.random().toString(36).substring(7));
	fs.mkdirsSync(dir);
	return dir;
}

let pm = null;

const config = new AppcdConfig({
	config: {
		home: expandPath('~/.appcelerator/appcd'),
		plugins: {
			defaultInactivityTimeout: 60 * 60 * 1000
		},
		server: {
			agentPollInterval: 1000
		}
	}
});

describe('PluginManager', () => {
	before(function () {
		this.fm = new FSWatchManager();
		this.sm = new SubprocessManager();

		Dispatcher.register('/appcd/fs/watch', this.fm);
		Dispatcher.register('/appcd/subprocess', this.sm);
		Dispatcher.register('/appcd/config', new ConfigService(config));
		Dispatcher.register('/appcd/status', () => {
			// squeltch
		});
	});

	beforeEach(function () {
		pm = null;
	});

	afterEach(async function () {
		if (pm) {
			await pm.shutdown();
			pm = null;
		}
	});

	after(async function () {
		fs.removeSync(tmpDir);

		this.fm.shutdown();
		await this.sm.shutdown();

		Dispatcher.root.routes = [];

		log(renderTree());
	});

	describe('Error Handling', () => {
		it('should error if options is not an object', () => {
			expect(() => {
				new PluginManager('foo');
			}).to.throw(TypeError, 'Expected options to be an object');
		});

		it('should error if paths option is not an array', () => {
			expect(() => {
				new PluginManager({
					paths: 'foo'
				});
			}).to.throw(TypeError, 'Expected paths option to be an array');
		});
	});

	describe('Register/unregister Plugin Path', () => {
		it('should not watch when no paths specified', async function () {
			pm = new PluginManager();
			await pm.init();

			expect(Object.keys(pm.pluginPaths)).to.have.lengthOf(0);
			expect(pm.registered).to.have.lengthOf(0);

			let stats = this.fm.status();
			expect(stats.nodes).to.equal(0);

			await pm.shutdown();
			pm = null;

			stats = this.fm.status();
			expect(stats.nodes).to.equal(0);
		});

		it('should watch empty path for plugins and shutdown', async function () {
			const dir = path.join(__dirname, 'fixtures', 'empty');
			pm = new PluginManager({ paths: [ '', null, dir ] });
			await pm.init();

			expect(Object.keys(pm.pluginPaths)).to.have.lengthOf(1);
			expect(pm.registered).to.have.lengthOf(0);

			await pm.shutdown();
			pm = null;

			const stats = this.fm.status();
			expect(stats.nodes).to.equal(0);
		});

		it('should error if plugin path is already registered', async function () {
			const dir = path.join(__dirname, 'fixtures', 'empty');
			pm = new PluginManager({ paths: [ '', null, dir ] });
			await pm.init();

			expect(Object.keys(pm.pluginPaths)).to.have.lengthOf(1);
			expect(pm.registered).to.have.lengthOf(0);

			let err;

			try {
				await pm.registerPluginPath(dir);
				err = new Error('Expected an error');
			} catch (e) {
				expect(e).to.be.instanceof(PluginError);
				expect(e.message).to.equal('Plugin Path Already Registered');

				await pm.shutdown();
				pm = null;

				const stats = this.fm.status();
				expect(stats.nodes).to.equal(0);
			}

			if (err) {
				throw err;
			}
		});

		it('should error if registering an invalid path',  async function () {
			const dir = path.join(__dirname, 'fixtures', 'empty');
			pm = new PluginManager({ paths: [ dir ] });
			await pm.init();

			return pm.registerPluginPath({})
				.then(() => {
					throw new Error('Expected error');
				}, err => {
					expect(err).to.be.instanceof(PluginError);
					expect(err.message).to.equal('Invalid plugin path');
				});
		});

		it('should error if registering a subdirectory of already registered path', async function () {
			const dir = path.join(__dirname, 'fixtures', 'empty');
			pm = new PluginManager({ paths: [ dir ] });
			await pm.init();

			return pm.registerPluginPath(__dirname)
				.then(() => {
					throw new Error('Expected error');
				}, err => {
					expect(err).to.be.instanceof(PluginError);
					expect(err.message).to.equal('Plugin Path Subdirectory Already Registered');
				});
		});

		it('should error if registering a parent directory of already registered path', async function () {
			const dir = path.join(__dirname, 'fixtures', 'empty');
			pm = new PluginManager({ paths: [ dir ] });
			await pm.init();

			return pm.registerPluginPath(path.join(dir, 'foo'))
				.then(() => {
					throw new Error('Expected error');
				}, err => {
					expect(err).to.be.instanceof(PluginError);
					expect(err.message).to.equal('Plugin path parent directory already registered');
				});
		});

		it('should error unregistering if plugin path is invalid', async function () {
			pm = new PluginManager();
			await pm.init();

			return pm.unregisterPluginPath(null)
				.then(() => {
					throw new Error('Expected error');
				}, err => {
					expect(err).to.be.instanceof(PluginError);
					expect(err.message).to.equal('Invalid plugin path');
				});
		});

		it('should error unregistering if plugin path is not registered', async function () {
			const dir = path.join(__dirname, 'fixtures', 'empty');
			pm = new PluginManager();
			await pm.init();

			try {
				await pm.unregisterPluginPath(dir);
			} catch (err) {
				expect(err).to.be.instanceof(PluginError);
				expect(err.message).to.equal('Plugin Path Not Registered');
				return;
			}

			throw new Error('Expected error');
		});
	});

	describe('Internal Plugins', () => {
		it('should register, start, and stop an internal plugin', async function () {
			this.timeout(10000);
			this.slow(9000);

			const pluginDir = path.join(__dirname, 'fixtures', 'good-internal');

			pm = new PluginManager({
				paths: [ pluginDir ]
			});
			await pm.init();

			await sleep(1000);

			log('Calling square...');
			const ctx = await Dispatcher.call('/good-internal/1.2.3/square', { data: { num: 3 } });
			expect(ctx.response).to.equal(9);

			await pm.unregisterPluginPath(pluginDir);

			await sleep(1000);

			expect(pm.registered).to.have.lengthOf(0);
		});

		it('should fail to load bad internal plugin', async function () {
			this.timeout(10000);
			this.slow(9000);

			const pluginDir = path.join(__dirname, 'fixtures', 'bad-internal');

			pm = new PluginManager();
			await pm.init();

			await pm.call('/register', {
				data: {
					path: pluginDir
				}
			});

			log('Calling square...');
			try {
				await Dispatcher.call('/bad-internal/1.2.3/square', { data: { num: 3 } });
			} catch (err) {
				expect(err).to.be.instanceof(PluginError);
				expect(err.message).to.match(/Failed to load plugin: .*Unexpected token/);
				const p = pm.registered[0];
				expect(p.state).to.equal('stopped');
				expect(p.error).to.match(/Failed to load plugin: .*Unexpected token/);
				return;
			}

			throw new Error('Expected the route to not be found');
		});
	});

	describe('External Plugins', () => {
		it('should register, start, and stop an external plugin', async function () {
			// we need to wait a long time just in case the Node.js version isn't installed
			this.timeout(30000);
			this.slow(29000);

			const pluginDir = path.join(__dirname, 'fixtures', 'good');

			pm = new PluginManager({
				paths: [ pluginDir ]
			});
			await pm.init();

			await sleep(1000);

			log('Calling square...');
			const ctx = await Dispatcher.call('/good/1.2.3/square', { data: { num: 3 } });
			expect(ctx.response).to.equal(9);
		});

		it('should register, start, and stop an external plugin using partial version match', async function () {
			this.timeout(40000);
			this.slow(39000);

			const pluginDir = path.join(__dirname, 'fixtures', 'good');

			pm = new PluginManager({
				paths: [ pluginDir ]
			});
			await pm.init();

			await sleep(1000);

			log('Calling square...');
			const ctx = await Dispatcher.call('/good/1.x/square', { data: { num: 3 } });
			expect(ctx.response).to.equal(9);
		});

		it('should call current time service plugin', async function () {
			this.timeout(40000);
			this.slow(39000);

			const pluginDir = path.join(__dirname, 'fixtures', 'time-service');

			pm = new PluginManager({
				paths: [ pluginDir ]
			});
			await pm.init();

			await sleep(1000);

			log('Getting current time...');
			const ctx = await Dispatcher.call('/time-service/latest/current-time');
			log('Current time =', ctx.response);
			expect(ctx.response).to.be.a('string');
			expect(ctx.response).to.match(/^\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)$/);
		});

		it('should subscribe to current time service plugin', async function () {
			this.timeout(40000);
			this.slow(39000);

			const pluginDir = path.join(__dirname, 'fixtures', 'time-service');

			pm = new PluginManager({
				paths: [ pluginDir ]
			});
			await pm.init();

			await sleep(1000);

			log('Getting current time...');
			const { response } = await Dispatcher.call('/time-service/latest/current-time', { type: 'subscribe' });
			let counter = 0;

			await new Promise((resolve, reject) => {
				response
					.on('data', async res => {
						try {
							switch (++counter) {
								case 1:
									log('Subscription started: %s', highlight(res.topic));
									expect(res.type).to.equal('subscribe');
									break;

								case 2:
								case 3:
								case 4:
									log('Received time: %s', highlight(res.message.time));
									expect(res.type).to.equal('event');
									expect(res.message.time).to.be.a('string');
									expect(res.message.time).to.match(/^\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)$/);

									if (counter === 4) {
										// unsubscribe... we don't care if it succeeds
										log('Unsubscribing from %s', highlight(res.topic));
										try {
											await Dispatcher.call('/time-service/latest/current-time', { sid: res.sid, type: 'unsubscribe', topic: res.topic });
										} catch (err) {
											reject(err);
										}
									}
									break;
							}
						} catch (e) {
							reject(e);
						}
					})
					.once('end', () => {
						log('Subscription stream closed');
						resolve();
					});
			});
		});

		it('should reload a modified external plugin', async function () {
			this.timeout(40000);
			this.slow(39000);

			const sourceDir = path.join(__dirname, 'fixtures', 'good');
			const pluginDir = makeTempDir();

			fs.copySync(sourceDir, pluginDir);

			pm = new PluginManager();
			await pm.init();

			await sleep(1000);

			await pm.call('/register', {
				data: {
					path: pluginDir
				}
			});

			log('Calling square...');
			let ctx = await Dispatcher.call('/good/1.2.3/square', { data: { num: 3 } });
			log(`Expecting ${ctx.response} to equal 9`);
			expect(ctx.response).to.equal(9);

			log('Copying modified square.js');
			fs.copySync(path.join(__dirname, 'fixtures', 'modified-square.js'), path.join(pluginDir, 'index.js'));

			// need to wait at least 2 seconds for the source change to be detected
			await sleep(3000);

			log('Calling square again...');
			ctx = await Dispatcher.call('/good/1.2.3/square', { data: { num: 3 } });
			expect(ctx.response).to.equal(27);

			log('Unregistering plugin');
			await pm.call('/unregister', {
				data: {
					path: pluginDir
				}
			});
			log('Done');
		});

		it('should spawn a plugin with a cwd of the plugin path', async function () {
			this.timeout(20000);
			this.slow(19000);

			const sourceDir = path.join(__dirname, 'fixtures', 'good-with-ignore');
			const pluginDir = makeTempDir();

			fs.copySync(sourceDir, pluginDir);

			pm = new PluginManager();
			await pm.init();

			await sleep(1000);

			await pm.call('/register', {
				data: {
					path: pluginDir
				}
			});

			log('Calling counter...');
			await Dispatcher.call('/good-with-ignore/1.2.3/counter');
			const counterFile = path.join(pluginDir, 'counter.txt');
			expect(fs.existsSync(counterFile)).to.equal(true);
			expect(fs.readFileSync(counterFile, { encoding: 'utf8' })).to.equal('1');
			fs.removeSync(counterFile);
			log('Done');
		});

		it('should not reload a plugin when file is ignored', async function () {
			this.timeout(40000);
			this.slow(39000);

			const sourceDir = path.join(__dirname, 'fixtures', 'good-with-ignore');
			const pluginDir = makeTempDir();

			fs.copySync(sourceDir, pluginDir);

			pm = new PluginManager();
			await pm.init();

			await sleep(1000);

			await pm.call('/register', {
				data: {
					path: pluginDir
				}
			});

			log('Calling counter...');
			let ctx = await Dispatcher.call('/good-with-ignore/1.2.3/counter');
			log(ctx.response);
			expect(ctx.response).to.equal(1);
			log('Writing to ignored file "ignoredFile.txt"');
			fs.writeFileSync(path.join(pluginDir, 'ignoredFile.txt'), 'hello');

			await sleep(3000);

			log('Calling counter again...');
			ctx = await Dispatcher.call('/good-with-ignore/1.2.3/counter');
			log(ctx.response);
			expect(ctx.response).to.equal(2);

			log('Writing to non-ignored file "file.txt"');
			fs.writeFileSync(path.join(pluginDir, 'file.txt'), 'hello');

			await sleep(3000);

			log('Calling counter again...');
			ctx = await Dispatcher.call('/good-with-ignore/1.2.3/counter');
			log(ctx.response);
			expect(ctx.response).to.equal(1);

			log('Unregistering plugin');
			await pm.call('/unregister', {
				data: {
					path: pluginDir
				}
			});
			log('Done');
		});

		it('should not reload a plugin when file is ignored using wildcards', async function () {
			this.timeout(40000);
			this.slow(39000);

			const sourceDir = path.join(__dirname, 'fixtures', 'good-with-ignore-wildcard');
			const pluginDir = makeTempDir();

			fs.copySync(sourceDir, pluginDir);

			pm = new PluginManager();
			await pm.init();

			await sleep(1000);

			await pm.call('/register', {
				data: {
					path: pluginDir
				}
			});

			log('Calling counter...');
			let ctx = await Dispatcher.call('/good-with-ignore-wildcard/1.2.3/counter');
			log(ctx.response);
			expect(ctx.response).to.equal(1);
			log('Writing to ignored file "ignored.txt"');
			fs.writeFileSync(path.join(pluginDir, 'ignored.txt'), 'hello');
			log('Writing to ignored file "ignored.js"');
			fs.writeFileSync(path.join(pluginDir, 'ignored.js'), 'exports = "hello"');
			log('Creating "ignored" directory');
			fs.mkdirsSync(path.join(pluginDir, 'ignored'));

			await sleep(3000);

			log('Calling counter again...');
			ctx = await Dispatcher.call('/good-with-ignore-wildcard/1.2.3/counter');
			log(ctx.response);
			expect(ctx.response).to.equal(2);

			log('Writing to non-ignored file "file.txt"');
			fs.writeFileSync(path.join(pluginDir, 'file.txt'), 'hello');

			await sleep(3000);

			log('Calling counter again...');
			ctx = await Dispatcher.call('/good-with-ignore-wildcard/1.2.3/counter');
			log(ctx.response);
			expect(ctx.response).to.equal(1);

			log('Unregistering plugin');
			await pm.call('/unregister', {
				data: {
					path: pluginDir
				}
			});
			log('Done');
		});

		it('should handle bad plugins', async function () {
			this.timeout(40000);
			this.slow(39000);

			const pluginDir = path.join(__dirname, 'fixtures', 'bad');

			pm = new PluginManager();
			await pm.init();

			await pm.call('/register', {
				data: {
					path: pluginDir
				}
			});

			log('Calling square...');
			try {
				await Dispatcher.call('/bad/1.2.3/foo', { data: { num: 3 } });
			} catch (err) {
				expect(err.message).to.match(/Failed to load plugin: .*Unexpected token/);
				const p = pm.registered[0];
				expect(p.state).to.equal('stopped');
				expect(p.exitCode).to.equal(6);
				expect(p.error).to.match(/Failed to load plugin: .*Unexpected token/);
				expect(p.pid).to.be.null;
				return;
			}

			throw new Error('Expected the route to not be found');
		});

		it('should return list of registered plugin versions', async function () {
			this.timeout(10000);
			this.slow(9000);

			const pluginDir = path.join(__dirname, 'fixtures', 'good');

			pm = new PluginManager({
				paths: [ pluginDir ]
			});
			await pm.init();

			await sleep(1000);

			const ctx = await Dispatcher.call('/good');
			expect(ctx.response).to.deep.equal([ '1.2.3' ]);
		});

		it('should call a service that calls a service in another plugin', async function () {
			this.timeout(40000);
			this.slow(39000);

			const pluginDir = path.join(__dirname, 'fixtures', 'xdep');

			pm = new PluginManager({
				paths: [ pluginDir ]
			});
			await pm.init();

			await sleep(1000);

			const ctx = await Dispatcher.call('/foo/1.0.0/reverse', { data: { str: 'Hello world!' } });
			expect(ctx.response).to.equal('!dlrow olleH');
		});

		it('should call a service that passes to the next route', async function () {
			this.timeout(10000);
			this.slow(9000);

			const pluginDir = path.join(__dirname, 'fixtures', 'xdep');

			pm = new PluginManager({
				paths: [ pluginDir ]
			});
			await pm.init();

			await sleep(1000);

			const ctx = await Dispatcher.call('/foo/1.0.0/pass');
			expect(ctx.response).to.equal('pass!');
		});

		it('should 404 after a plugin is unregistered', async function () {
			this.timeout(40000);
			this.slow(39000);

			const pluginDir = path.join(__dirname, 'fixtures', 'good');

			pm = new PluginManager({
				paths: [ pluginDir ]
			});
			await pm.init();

			await sleep(1000);

			log('Calling square...');
			const ctx = await Dispatcher.call('/good/1.2.3/square', { data: { num: 3 } });
			expect(ctx.response).to.equal(9);

			await pm.unregisterPluginPath(pluginDir);

			await sleep(1000);

			try {
				await Dispatcher.call('/good/1.2.3/square', { data: { num: 3 } });
			} catch (err) {
				expect(err).to.be.instanceof(DispatcherError);
				expect(err.status).to.equal(404);
				expect(err.statusCode).to.equal(404);
				return;
			}

			throw new Error('Expected 404');
		});

		it('should call service implemented in a require()\'d js file', async function () {
			this.timeout(10000);
			this.slow(9000);

			const pluginDir = path.join(__dirname, 'fixtures', 'require-test');

			pm = new PluginManager({
				paths: [ pluginDir ]
			});
			await pm.init();

			await sleep(1000);

			const ctx = await Dispatcher.call('/require-test/1.0.0/hi');
			expect(ctx.response).to.match(/^Hello .+!$/);
		});

		it('should subscribe to a service that subscribes a service in another plugin', async function () {
			this.timeout(20000);
			this.slow(19000);

			const pluginDir = path.join(__dirname, 'fixtures', 'xdep');

			pm = new PluginManager({
				paths: [ pluginDir ]
			});
			await pm.init();

			let counter = 0;

			await sleep(1000);

			const { response } = await Dispatcher.call('/foo/1.0.0/time', { type: 'subscribe' });

			await new Promise((resolve, reject) => {
				response
					.on('data', async res => {
						counter++;
						log(counter, res);

						switch (counter) {
							case 1:
								expect(res.type).to.equal('subscribe');
								expect(res.message).to.equal('Subscribed');
								break;

							case 2:
								expect(res.type).to.equal('event');
								expect(res.message).to.be.an('object');
								expect(res.message.time).to.be.a('string');
								expect(res.message.time).to.match(/^\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)$/);
								break;

							case 3:
								log('Unsubscribing from %s', highlight(res.sid));
								try {
									await Dispatcher.call('/foo/1.0.0/time', { sid: res.sid, type: 'unsubscribe' });
								} catch (err) {
									reject(err);
								}
						}
					})
					.once('end', () => {
						log('foo response ended');
						resolve();
					})
					.once('error', reject);
			});
		});

		it('should load a plugin with a js file with empty shebang', async function () {
			this.timeout(10000);
			this.slow(9000);

			const pluginDir = path.join(__dirname, 'fixtures', 'shebang-empty');

			pm = new PluginManager({
				paths: [ pluginDir ]
			});
			await pm.init();

			await sleep(1000);

			log('Calling square...');
			try {
				await Dispatcher.call('/shebang-empty/1.0.0/square', { data: { num: 3 } });
			} catch (err) {
				expect(err).to.be.instanceof(DispatcherError);
				expect(err.statusCode).to.equal(404);
				return;
			}

			throw new Error('Expected 404');
		});

		it('should load a plugin with a js file with non-empty shebang', async function () {
			this.timeout(10000);
			this.slow(9000);

			const pluginDir = path.join(__dirname, 'fixtures', 'shebang-node');

			pm = new PluginManager({
				paths: [ pluginDir ]
			});
			await pm.init();

			await sleep(1000);

			log('Calling square...');
			try {
				await Dispatcher.call('/shebang-empty/1.0.0/square', { data: { num: 3 } });
			} catch (err) {
				expect(err).to.be.instanceof(DispatcherError);
				expect(err.statusCode).to.equal(404);
				return;
			}

			throw new Error('Expected 404');
		});

		it('should return plugin info', async function () {
			this.timeout(10000);
			this.slow(9000);

			const pluginDir = path.join(__dirname, 'fixtures', 'good');

			pm = new PluginManager({
				paths: [ pluginDir ]
			});
			await pm.init();

			await sleep(1000);

			log('Calling info...');
			let ctx = await Dispatcher.call('/good/1.2.3/');
			let resp = ctx.response;
			expect(resp.type).to.equal('external');
			expect(resp.path).to.equal(pluginDir);
			expect(resp.version).to.equal('1.2.3');

			ctx = await Dispatcher.call('/good/latest/');
			resp = ctx.response;
			expect(resp.type).to.equal('external');
			expect(resp.path).to.equal(pluginDir);
			expect(resp.version).to.equal('1.2.3');
		});

		it('should spawn a process and receive all output events', async function () {
			this.timeout(10000);
			this.slow(9000);

			const pluginDir = path.join(__dirname, 'fixtures', 'spawn-test');

			pm = new PluginManager({
				paths: [ pluginDir ]
			});
			await pm.init();

			await sleep(1000);

			log('Calling spawn-test...');
			const ctx = await Dispatcher.call('/spawn-test/1.2.3/spawn');
			expect(ctx.response).to.be.instanceof(PassThrough);

			await new Promise((resolve, reject) => {
				let counter = 0;

				ctx.response
					.on('data', message => {
						try {
							switch (++counter) {
								case 1:
									expect(message.type).to.equal('spawn');
									break;
								case 2:
									expect(message.type).to.equal('stdout');
									expect(message.output).to.equal('Hello\n');
									break;
								case 3:
									expect(message.type).to.equal('stderr');
									expect(message.output).to.equal('Oh no!\n');
									break;
								case 4:
									expect(message.type).to.equal('stdout');
									expect(message.output).to.equal('Just kidding\n');
									break;
								case 5:
									expect(message.type).to.equal('exit');
									expect(message.code).to.equal(0);
									break;
							}
						} catch (e) {
							reject(e);
						}
					})
					.on('end', resolve)
					.on('error', reject);
			});
		});
	});

	/**
	 * Missing edge case unit tests:
	 *
	 *   - plugin states: stop when already stopping, stop when starting, state change w/ error
	 *   - external plugin that has subscription and message is a string
	 *   - external plugin that has subscription that emits an error
	 *   - external plugin that subscribes and unsubscribes from parent
	 *   - external plugin that subscribes to parent and closes after N events
	 *   - external plugin that subscribes to parent and emits error
	 *   - external plugin that makes request and parent emits an error
	 *   - external plugin that fails to get config from parent
	 *   - internal plugin that has a dispatcher that returns an error
	 */
});
