import appcdLogger from 'appcd-logger';
import Config from 'appcd-config';
import ConfigService from 'appcd-config-service';
import Dispatcher, { DispatcherError } from 'appcd-dispatcher';
import fs from 'fs-extra';
import FSWatchManager from 'appcd-fswatcher';
import gawk from 'gawk';
import path from 'path';
import PluginError from '../dist/plugin-error';
import PluginManager from '../dist/index';
import SubprocessManager from 'appcd-subprocess';
import tmp from 'tmp';

import { expandPath } from 'appcd-path';

const { log } = appcdLogger('test:appcd:plugin:manager');
const { highlight } = appcdLogger.styles;

const tmpDir = tmp.dirSync({
	prefix: 'appcd-plugin-test-',
	unsafeCleanup: true
}).name;

function makeTempDir() {
	const dir = path.join(tmpDir, Math.random().toString(36).substring(7));
	fs.mkdirsSync(dir);
	return dir;
}

let pm = null;

const config = new Config({
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
config.values = gawk(config.values);
config.watch = (filter, listener) => gawk.watch(config.values, filter, listener);
config.unwatch = listener => gawk.unwatch(config.values, listener);

describe('PluginManager', () => {
	before(function () {
		this.fm = new FSWatchManager();
		this.sm = new SubprocessManager();

		Dispatcher.register('/appcd/fs/watch', this.fm.dispatcher);
		Dispatcher.register('/appcd/subprocess', this.sm.dispatcher);
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

		log();
	});

	after(async function () {
		fs.removeSync(tmpDir);

		this.fm.shutdown();
		await this.sm.shutdown();

		Dispatcher.root.routes = [];
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

	describe('Register/unregister', () => {
		it('should not watch when no paths specified', async function () {
			pm = new PluginManager();

			expect(Object.keys(pm.pluginPaths)).to.have.lengthOf(0);
			expect(pm.plugins).to.have.lengthOf(0);

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

			expect(Object.keys(pm.pluginPaths)).to.have.lengthOf(1);
			expect(pm.plugins).to.have.lengthOf(0);

			await pm.shutdown();
			pm = null;

			const stats = this.fm.status();
			expect(stats.nodes).to.equal(0);
		});

		it('should error if plugin path is already registered', async function () {
			const dir = path.join(__dirname, 'fixtures', 'empty');
			pm = new PluginManager({ paths: [ '', null, dir ] });

			expect(Object.keys(pm.pluginPaths)).to.have.lengthOf(1);
			expect(pm.plugins).to.have.lengthOf(0);

			let err;

			try {
				await pm.register(dir);
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

			return pm.register({})
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

			return pm.register(__dirname)
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

			return pm.register(path.join(dir, 'foo'))
				.then(() => {
					throw new Error('Expected error');
				}, err => {
					expect(err).to.be.instanceof(PluginError);
					expect(err.message).to.equal('Plugin Path Parent Directory Already Registered');
				});
		});

		it('should error unregistering if plugin path is invalid', function () {
			pm = new PluginManager();

			return pm.unregister(null)
				.then(() => {
					throw new Error('Expected error');
				}, err => {
					expect(err).to.be.instanceof(PluginError);
					expect(err.message).to.equal('Invalid plugin path');
				});
		});

		it('should error unregistering if plugin path is not registered', function () {
			const dir = path.join(__dirname, 'fixtures', 'empty');
			pm = new PluginManager();

			return pm.unregister(dir)
				.then(() => {
					throw new Error('Expected error');
				}, err => {
					expect(err).to.be.instanceof(PluginError);
					expect(err.message).to.equal('Plugin Path Not Registered');
				});
		});
	});

	describe('Internal Plugins', () => {
		it('should register, start, and stop an internal plugin', function (done) {
			this.timeout(10000);
			this.slow(9000);

			const pluginDir = path.join(__dirname, 'fixtures', 'good-internal');

			pm = new PluginManager({
				paths: [ pluginDir ]
			});

			setTimeout(() => {
				log('Calling square...');
				Dispatcher.call('/good-internal/1.2.3/square', { data: { num: 3 } })
					.then(async (ctx) => {
						expect(ctx.response).to.equal(9);
						await pm.unregister(pluginDir);
						setTimeout(() => {
							try {
								expect(pm.plugins).to.have.lengthOf(0);
								done();
							} catch (e) {
								done(e);
							}
						}, 1000);
					})
					.catch(done);
			}, 1000);
		});

		it('should fail to load bad internal plugin', function (done) {
			this.timeout(10000);
			this.slow(9000);

			const pluginDir = path.join(__dirname, 'fixtures', 'bad-internal');

			pm = new PluginManager();

			pm.dispatcher
				.call('/register', {
					data: {
						path: pluginDir
					}
				})
				.then(() => {
					log('Calling square...');
					return Dispatcher.call('/bad-internal/1.2.3/square', { data: { num: 3 } })
						.then(() => {
							throw new Error('Expected the route to not be found');
						}, err => {
							expect(err.message).to.equal('Failed to load plugin: Unexpected token )');
							const p = pm.plugins[0];
							expect(p.state).to.equal('stopped');
							expect(p.error).to.equal('Failed to load plugin: Unexpected token )');
						});
				})
				.then(() => done())
				.catch(done);
		});
	});

	describe('External Plugins', () => {
		it('should register, start, and stop an external plugin', function (done) {
			// we need to wait a long time just in case the Node.js version isn't installed
			this.timeout(30000);
			this.slow(29000);

			const pluginDir = path.join(__dirname, 'fixtures', 'good');

			pm = new PluginManager({
				paths: [ pluginDir ]
			});

			setTimeout(() => {
				log('Calling square...');
				Dispatcher.call('/good/1.2.3/square', { data: { num: 3 } })
					.then(ctx => {
						expect(ctx.response).to.equal(9);
						done();
					})
					.catch(done);
			}, 1000);
		});

		it('should register, start, and stop an external plugin using partial version match', function (done) {
			this.timeout(10000);
			this.slow(9000);

			const pluginDir = path.join(__dirname, 'fixtures', 'good');

			pm = new PluginManager({
				paths: [ pluginDir ]
			});

			setTimeout(() => {
				log('Calling square...');
				Dispatcher.call('/good/1.x/square', { data: { num: 3 } })
					.then(ctx => {
						expect(ctx.response).to.equal(9);
						done();
					})
					.catch(done);
			}, 1000);
		});

		it('should call current time service plugin', function (done) {
			this.timeout(10000);
			this.slow(9000);

			const pluginDir = path.join(__dirname, 'fixtures', 'time-service');

			pm = new PluginManager({
				paths: [ pluginDir ]
			});

			setTimeout(() => {
				log('Getting current time...');
				Dispatcher.call('/time-service/latest/current-time')
					.then(ctx => {
						log('Current time =', ctx.response);
						expect(ctx.response).to.be.a('string');
						expect(ctx.response).to.match(/^\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)$/);
						done();
					})
					.catch(done);
			}, 1000);
		});

		it('should subscribe to current time service plugin', function (done) {
			this.timeout(20000);
			this.slow(19000);

			const pluginDir = path.join(__dirname, 'fixtures', 'time-service');

			pm = new PluginManager({
				paths: [ pluginDir ]
			});

			setTimeout(() => {
				log('Getting current time...');
				Dispatcher.call('/time-service/latest/current-time', { type: 'subscribe' })
					.then(ctx => {
						let counter = 0;

						ctx.response
							.on('data', res => {
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
												Dispatcher
													.call('/time-service/latest/current-time', { sid: res.sid, type: 'unsubscribe', topic: res.topic })
													.catch(done);
											}
											break;
									}
								} catch (e) {
									done(e);
								}
							})
							.once('end', () => {
								log('Subscription stream closed');
								done();
							});
					})
					.catch(done);
			}, 1000);
		});

		it('should reload a modified external plugin', function (done) {
			this.timeout(10000);
			this.slow(9000);

			const sourceDir = path.join(__dirname, 'fixtures', 'good');
			const pluginDir = makeTempDir();

			fs.copySync(sourceDir, pluginDir);

			pm = new PluginManager();

			setTimeout(() => {
				pm.dispatcher
					.call('/register', {
						data: {
							path: pluginDir
						}
					})
					.then(() => {
						log('Calling square...');
						return Dispatcher
							.call('/good/1.2.3/square', { data: { num: 3 } });
					})
					.then(ctx => {
						expect(ctx.response).to.equal(9);

						fs.copySync(path.join(__dirname, 'fixtures', 'modified-square.js'), path.join(pluginDir, 'index.js'));

						return new Promise(resolve => setTimeout(resolve, 1000));
					})
					.then(() => {
						log('Calling square again...');
						return Dispatcher
							.call('/good/1.2.3/square', { data: { num: 3 } });
					})
					.then(ctx => {
						expect(ctx.response).to.equal(27);

						return pm.dispatcher
							.call('/unregister', {
								data: {
									path: pluginDir
								}
							});
					})
					.then(() => done())
					.catch(done);
			}, 1000);
		});

		it('should handle bad plugins', function (done) {
			this.timeout(10000);
			this.slow(9000);

			const pluginDir = path.join(__dirname, 'fixtures', 'bad');

			pm = new PluginManager();

			pm.dispatcher
				.call('/register', {
					data: {
						path: pluginDir
					}
				})
				.then(() => {
					log('Calling square...');
					return Dispatcher.call('/bad/1.2.3/foo', { data: { num: 3 } })
						.then(() => {
							done(new Error('Expected the route to not be found'));
						})
						.catch(err => {
							expect(err.message).to.equal('Failed to load plugin: Unexpected token )');
							const p = pm.plugins[0];
							expect(p.state).to.equal('stopped');
							expect(p.exitCode).to.equal(6);
							expect(p.error).to.equal('Failed to load plugin: Unexpected token )');
							expect(p.pid).to.be.null;
						});
				})
				.then(() => done())
				.catch(done);
		});

		it('should return list of registered plugin versions', function (done) {
			this.timeout(10000);
			this.slow(9000);

			const pluginDir = path.join(__dirname, 'fixtures', 'good');

			pm = new PluginManager({
				paths: [ pluginDir ]
			});

			setTimeout(() => {
				Dispatcher.call('/good')
					.then(ctx => {
						expect(ctx.response).to.deep.equal([ '1.2.3' ]);
						done();
					})
					.catch(done);
			}, 1000);
		});

		it('should call a service that calls a service in another plugin', function (done) {
			this.timeout(10000);
			this.slow(9000);

			const pluginDir = path.join(__dirname, 'fixtures', 'xdep');

			pm = new PluginManager({
				paths: [ pluginDir ]
			});

			setTimeout(() => {
				Dispatcher.call('/foo/1.0.0/reverse', { data: { str: 'Hello world!' } })
					.then(ctx => {
						expect(ctx.response).to.equal('!dlrow olleH');
						done();
					})
					.catch(done);
			}, 1000);
		});

		it('should call a service that passes to the next route', function (done) {
			this.timeout(10000);
			this.slow(9000);

			const pluginDir = path.join(__dirname, 'fixtures', 'xdep');

			pm = new PluginManager({
				paths: [ pluginDir ]
			});

			setTimeout(() => {
				Dispatcher.call('/foo/1.0.0/pass')
					.then(ctx => {
						expect(ctx.response).to.equal('pass!');
						done();
					})
					.catch(err => {
						done(err);
					});
			}, 1000);
		});

		it('should 404 after a plugin is unregistered', function (done) {
			this.timeout(10000);
			this.slow(9000);

			const pluginDir = path.join(__dirname, 'fixtures', 'good');

			pm = new PluginManager({
				paths: [ pluginDir ]
			});

			setTimeout(() => {
				log('Calling square...');
				Dispatcher.call('/good/1.2.3/square', { data: { num: 3 } })
					.then(ctx => {
						expect(ctx.response).to.equal(9);
						return pm.unregister(pluginDir);
					})
					.then(() => new Promise(resolve => {
						setTimeout(resolve, 1000);
					}))
					.then(() => {
						return Dispatcher.call('/good/1.2.3/square', { data: { num: 3 } });
					})
					.then(() => {
						throw new Error('Expected 404');
					}, err => {
						expect(err).to.be.instanceof(DispatcherError);
						expect(err.statusCode).to.equal(404);
						done();
					})
					.catch(done);
			}, 1000);
		});

		it('should call service implemented in a require()\'d js file', function (done) {
			this.timeout(10000);
			this.slow(9000);

			const pluginDir = path.join(__dirname, 'fixtures', 'require-test');

			pm = new PluginManager({
				paths: [ pluginDir ]
			});

			setTimeout(() => {
				Dispatcher.call('/require-test/1.0.0/hi')
					.then(ctx => {
						expect(ctx.response).to.match(/^Hello .+!$/);
						done();
					})
					.catch(err => {
						done(err);
					});
			}, 1000);
		});

		it('should subscribe to a service that subscribes a service in another plugin', function (done) {
			this.timeout(16000);
			this.slow(15000);

			const pluginDir = path.join(__dirname, 'fixtures', 'xdep');

			pm = new PluginManager({
				paths: [ pluginDir ]
			});

			let counter = 0;

			setTimeout(() => {
				Dispatcher.call('/foo/1.0.0/time', { type: 'subscribe' })
					.then(ctx => {
						ctx.response
							.on('data', res => {
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
										Dispatcher
											.call('/foo/1.0.0/time', { sid: res.sid, type: 'unsubscribe' })
											.catch(done);
								}
							})
							.on('end', () => {
								log('foo response ended');
								done();
							})
							.on('error', done);
					})
					.catch(err => {
						done(err);
					});
			}, 1000);
		});

		it('should load a plugin with a js file with empty shebang', function (done) {
			this.timeout(10000);
			this.slow(9000);

			const pluginDir = path.join(__dirname, 'fixtures', 'shebang-empty');

			pm = new PluginManager({
				paths: [ pluginDir ]
			});

			setTimeout(() => {
				log('Calling square...');
				Dispatcher.call('/shebang-empty/1.0.0/square', { data: { num: 3 } })
					.then(() => {
						throw new Error('Expected 404');
					}, err => {
						expect(err).to.be.instanceof(DispatcherError);
						expect(err.statusCode).to.equal(404);
						done();
					})
					.catch(done);
			}, 1000);
		});

		it('should load a plugin with a js file with non-empty shebang', function (done) {
			this.timeout(10000);
			this.slow(9000);

			const pluginDir = path.join(__dirname, 'fixtures', 'shebang-node');

			pm = new PluginManager({
				paths: [ pluginDir ]
			});

			setTimeout(() => {
				log('Calling square...');
				Dispatcher.call('/shebang-empty/1.0.0/square', { data: { num: 3 } })
					.then(() => {
						throw new Error('Expected 404');
					}, err => {
						expect(err).to.be.instanceof(DispatcherError);
						expect(err.statusCode).to.equal(404);
						done();
					})
					.catch(done);
			}, 1000);
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
