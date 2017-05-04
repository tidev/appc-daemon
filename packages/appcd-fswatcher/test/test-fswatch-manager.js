import fs from 'fs-extra';
import FSWatchManager, { renderTree, reset, roots } from '../src/index';
import path from 'path';
import snooplogg from 'snooplogg';
import tmp from 'tmp';

import { DispatcherError } from 'appcd-dispatcher';

const log = snooplogg.config({ theme: 'standard' })('test:appcd:fswatcher:manager').log;
const { highlight } = snooplogg.styles;

const _tmpDir = tmp.dirSync({
	prefix: 'appcd-fswatcher-test-',
	unsafeCleanup: true
}).name;
const tmpDir = realPath(_tmpDir);

function makeTempName() {
	return path.join(_tmpDir, Math.random().toString(36).substring(7));
}

function makeTempDir() {
	const dir = makeTempName();
	fs.mkdirsSync(dir);
	return dir;
}

function realPath(p) {
	try {
		return fs.realpathSync(p);
	} catch (e) {
		const basename = path.basename(p);
		p = path.dirname(p);
		if (p === path.dirname(p)) {
			return p;
		}
		return path.join(realPath(p), basename);
	}
}

describe('FSWatchManager', () => {
	describe('error handling', () => {
		it('should continue to next route if type is a call', done => {
			const manager = new FSWatchManager;

			Promise.resolve()
				.then(() => new Promise((resolve, reject) => {
					manager.dispatcher.handler({
						path: '/'
					}, () => {
						done();
						return Promise.resolve();
					});
				}))
				.catch(done);
		});

		it('should fail if watch path not specified', done => {
			const manager = new FSWatchManager;

			Promise.resolve()
				.then(() => new Promise((resolve, reject) => {
					manager.dispatcher.handler({
						path: '/',
						payload: {
							sessionId: 0,
							type: 'subscribe'
						}
					}, () => Promise.resolve());
				}))
				.then(() => {
					done(new Error('Expected error because watch path was not specified'));
				}, err => {
					expect(err).to.be.instanceof(DispatcherError);
					expect(err.status).to.equal(400);
					expect(err.statusCode).to.equal('400.5');
					expect(err.message).to.equal('Missing required parameter "path"');
					done();
				})
				.catch(done);
		});
	});

	describe('watch', () => {
		after(() => {
			fs.removeSync(tmpDir);
		});

		afterEach(function (done) {
			this.timeout(10000);
			reset();
			log(renderTree());
			setTimeout(() => done(), 1000);
		});

		it('should subscribe to fs watcher', function (done) {
			this.timeout(10000);
			this.slow(8000);

			const tmp = makeTempDir();
			log('Creating tmp directory: %s', highlight(tmp));

			const filename = path.join(tmp, 'foo.txt');
			const manager = new FSWatchManager;
			let counter = 0;

			const stats = manager.status();
			expect(stats.nodes).to.equal(0);
			expect(stats.fswatchers).to.equal(0);
			expect(stats.watchers).to.equal(0);

			setTimeout(() => {
				Promise.resolve()
					.then(() => new Promise((resolve, reject) => {
						log('Subscribing');
						manager.dispatcher.handler({
							payload: {
								data: { path: tmp },
								sessionId: 0,
								type: 'subscribe'
							},
							response: {
								once: () => {},
								write: response => {
									try {
										counter++;

										if (counter === 1) {
											expect(response.message.toString()).to.equal('Subscribed');
											expect(response.message.status).to.equal(201);
											expect(response.topic).to.equal(tmp);
											expect(response.type).to.equal('subscribe');
										} else {
											expect(response).to.deep.equal({
												message: {
													action: 'add',
													filename: 'foo.txt',
													file: realPath(filename)
												},
												topic: tmp
											});

											const stats = manager.status();
											expect(stats.nodes).to.be.above(0);
											expect(stats.fswatchers).to.be.above(0);
											expect(stats.watchers).to.equal(1);

											log('Unsubscribing');
											const ctx = {
												payload: {
													sessionId: 0,
													topic: tmp,
													type: 'unsubscribe'
												},
												response: {
													once: () => {},
													write: response => {}
												}
											};
											manager.dispatcher.handler(ctx, () => Promise.resolve());

											expect(ctx.response.toString()).to.equal('Unsubscribed');
											expect(ctx.response.status).to.equal(200);
											expect(ctx.response.statusCode).to.equal('200.1');
											expect(Object.keys(manager.dispatcher.subscriptions)).to.have.lengthOf(0);

											expect(roots).to.deep.equal({});

											resolve();
										}
									} catch (e) {
										reject(e);
									}
								}
							}
						}, () => Promise.resolve());
					}))
					.then(() => done())
					.catch(done);

				setTimeout(() => {
					log('Writing %s', highlight(filename));
					fs.writeFileSync(filename, 'foo!');
				}, 100);
			}, 100);
		});
	});
});
