import Config from 'appcd-config';
import ConfigService from 'appcd-config-service';
import Dispatcher from 'appcd-dispatcher';
import FSWatchManager from 'appcd-fswatcher';
import gawk from 'gawk';
import path from 'path';
import PluginError from '../dist/plugin-error';
import PluginManager from '../dist/index';
import snooplogg from 'snooplogg';
import SubprocessManager from 'appcd-subprocess';

import { expandPath } from 'appcd-path';

const log = snooplogg
	.config({
		minBrightness: 80,
		maxBrightness: 210,
		theme: 'detailed'
	})
	.ns('test:appcd:plugin:manager').log;

const { highlight } = snooplogg.styles;

describe('PluginManager', () => {
	before(function () {
		const fm = this.fm = new FSWatchManager();
		Dispatcher.register('/appcd/fs/watch', fm.dispatcher);

		const sm = this.sm = new SubprocessManager();
		Dispatcher.register('/appcd/subprocess', sm.dispatcher);

		const config = new Config({
			config: {
				home: expandPath('~/.appcelerator/appcd'),
				server: {
					defaultPluginInactivityTimeout: 60 * 60 * 1000
				}
			}
		});
		config.values = gawk(config.values);
		config.watch = (filter, listener) => gawk.watch(config.values, filter, listener);
		config.unwatch = listener => gawk.unwatch(config.values, listener);
		Dispatcher.register('/appcd/config', new ConfigService(config));

		Dispatcher.register('/appcd/status', ctx => {
			// squeltch
		});
	});

	beforeEach(function () {
		this.pm = null;
	});

	afterEach(async function () {
		if (this.pm) {
			await this.pm.shutdown();
			this.pm = null;
		}
	});

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

	it('should not watch when no paths specified', async function () {
		this.pm = new PluginManager();

		expect(Object.keys(this.pm.pluginPaths)).to.have.lengthOf(0);
		expect(this.pm.plugins).to.have.lengthOf(0);

		let stats = this.fm.status();
		expect(stats.nodes).to.equal(0);

		await this.pm.shutdown();
		this.pm = null;

		stats = this.fm.status();
		expect(stats.nodes).to.equal(0);
	});

	it('should watch empty path for plugins and shutdown', async function () {
		const dir = path.join(__dirname, 'fixtures', 'empty');
		this.pm = new PluginManager({ paths: [ '', null, dir ] });

		expect(Object.keys(this.pm.pluginPaths)).to.have.lengthOf(1);
		expect(this.pm.plugins).to.have.lengthOf(0);

		await this.pm.shutdown();
		this.pm = null;

		const stats = this.fm.status();
		expect(stats.nodes).to.equal(0);
	});

	it('should error if plugin path is already registered', async function () {
		const dir = path.join(__dirname, 'fixtures', 'empty');
		this.pm = new PluginManager({ paths: [ '', null, dir ] });

		expect(Object.keys(this.pm.pluginPaths)).to.have.lengthOf(1);
		expect(this.pm.plugins).to.have.lengthOf(0);

		let err;

		try {
			await this.pm.register(dir);
			err = new Error('Expected an error');
		} catch (e) {
			expect(e).to.be.instanceof(PluginError);
			expect(e.message).to.equal('Plugin Path Already Registered');

			await this.pm.shutdown();
			this.pm = null;

			const stats = this.fm.status();
			expect(stats.nodes).to.equal(0);
		}

		if (err) {
			throw err;
		}
	});

	it('should error if registering a subdirectory of already registered path', async function () {
		const dir = path.join(__dirname, 'fixtures', 'empty');
		this.pm = new PluginManager({ paths: [ dir ] });

		return this.pm.register(__dirname)
			.then(() => {
				throw new Error('Expected error');
			}, err => {
				expect(err).to.be.instanceof(PluginError);
				expect(err.message).to.equal('Plugin Path Subdirectory Already Registered');
			});
	});

	it('should error if registering a parent directory of already registered path', async function () {
		const dir = path.join(__dirname, 'fixtures', 'empty');
		this.pm = new PluginManager({ paths: [ dir ] });

		return this.pm.register(path.join(dir, 'foo'))
			.then(() => {
				throw new Error('Expected error');
			}, err => {
				expect(err).to.be.instanceof(PluginError);
				expect(err.message).to.equal('Plugin Path Parent Directory Already Registered');
			});
	});

	it('should error unregistering if plugin path is invalid', function () {
		this.pm = new PluginManager;

		return this.pm.unregister(null)
			.then(() => {
				throw new Error('Expected error');
			}, err => {
				expect(err).to.be.instanceof(PluginError);
				expect(err.message).to.equal('Invalid plugin path');
			});
	});

	it('should error unregistering if plugin path is not registered', function () {
		const dir = path.join(__dirname, 'fixtures', 'empty');
		this.pm = new PluginManager;

		return this.pm.unregister(dir)
			.then(() => {
				throw new Error('Expected error');
			}, err => {
				expect(err).to.be.instanceof(PluginError);
				expect(err.message).to.equal('Plugin Path Not Registered');
			});
	});

	it('should register, start, and stop an internal plugin', function (done) {
		this.timeout(10000);
		this.slow(9000);

		const pluginDir = path.join(__dirname, 'fixtures', 'good-internal');

		this.pm = new PluginManager({
			paths: [ pluginDir ]
		});

		setTimeout(() => {
			log('Calling square...');
			Dispatcher.call('/good-internal/1.2.3/square', { data: { num: 3 } })
				.then(async (ctx) => {
					expect(ctx.response).to.equal(9);
					await this.pm.unregister(pluginDir);
					setTimeout(() => {
						try {
							expect(this.pm.plugins).to.have.lengthOf(0);
							done();
						} catch (e) {
							done(e);
						}
					}, 1000);
				})
				.catch(done);
		}, 1000);
	});

	it('should register, start, and stop an external plugin', function (done) {
		this.timeout(90000);
		this.slow(90000);

		const pluginDir = path.join(__dirname, 'fixtures', 'good');

		this.pm = new PluginManager({
			paths: [ pluginDir ]
		});

		setTimeout(() => {
			log('Calling square...');
			Dispatcher.call('/good/1.2.3/square', { data: { num: 3 } })
				.then(async (ctx) => {
					expect(ctx.response).to.equal(9);
					setTimeout(() => {
						done();
					}, 7000);
				})
				.catch(done);
		}, 1000);
	});

	it('should call current time service plugin', function (done) {
		this.timeout(10000);
		this.slow(9000);

		const pluginDir = path.join(__dirname, 'fixtures', 'pubsub');

		this.pm = new PluginManager({
			paths: [ pluginDir ]
		});

		setTimeout(() => {
			log('Getting current time...');
			Dispatcher.call('/pubsub/latest/current-time')
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

		const pluginDir = path.join(__dirname, 'fixtures', 'pubsub');

		this.pm = new PluginManager({
			paths: [ pluginDir ]
		});

		setTimeout(() => {
			log('Getting current time...');
			Dispatcher.call('/pubsub/latest/current-time', { type: 'subscribe' })
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
												.call('/pubsub/latest/current-time', { type: 'unsubscribe', topic: res.topic })
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

	// bad plugins
	// plugin that has a dispatcher that returns an error
});
