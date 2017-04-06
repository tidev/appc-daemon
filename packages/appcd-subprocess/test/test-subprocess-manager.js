import Dispatcher from 'appcd-dispatcher';
import path from 'path';
import SubprocessError from '../src/subprocess-error';
import SubprocessManager from '../src/index';
import tmp from 'tmp';

tmp.setGracefulCleanup();
function makeTempDir() {
	return tmp.dirSync({
		prefix: 'appcd-subprocess-test-',
		unsafeCleanup: true
	}).name;
}

describe('SubprocessManager', () => {
	describe('Spawn', () => {
		beforeEach(() => {
			Dispatcher.root.routes = [];
		});

		afterEach(() => {
			Dispatcher.root.routes = [];
		});

		it('should spawn 5 sleep processes', function (done) {
			this.slow(9000);
			this.timeout(10000);

			const args = [
				path.join(__dirname, 'fixtures', 'sleep.js'),
				'2000'
			];
			const options = {
				stdio: 'ignore'
			};
			const sm = new SubprocessManager();
			let count = 0;
			let killedPid = null;

			sm.on('change', () => {
				count++;
			});

			sm.on('spawn', proc => {
				if (count === 5) {
					sm.dispatcher
						.call('/status')
						.then(ctx => {
							expect(ctx.response).to.be.an.Array;
							expect(ctx.response).to.have.lengthOf(5);

							for (const desc of ctx.response) {
								expect(desc).to.be.an.Object;
								expect(desc).to.have.keys('pid', 'command', 'args', 'options', 'startTime');
								expect(desc.pid).to.be.a.Number;
								expect(desc.pid).to.be.at.least(1);
								expect(desc.command).to.equal(process.execPath);
								expect(desc.args).to.deep.equal(args);
								expect(desc.options).to.deep.equal(options);
								expect(desc.startTime).to.be.a.Date;
							}

							const { pid } = ctx.response[0];

							return sm.dispatcher
								.call(`/kill/${pid}`)
								.then(ctx => {
									expect(ctx.response.toString()).to.equal('OK');
									expect(ctx.response.status).to.equal(200);
									expect(ctx.response.statusCode).to.equal(200);

									return new Promise((resolve, reject) => {
										setImmediate(() => {
											expect(killedPid).to.equal(pid);

											sm.dispatcher
												.call('/status')
												.then(ctx => {
													expect(ctx.response).to.be.an.Array;
													expect(ctx.response).to.have.lengthOf(4);

													// wait for the other 4 child processes to exit
													return Promise.all(calls);
												})
												.then(resolve)
												.catch(reject);
										});
									});
								});
						})
						.then(() => {
							// there should have been 10 changes to the subprocesses array
							// 5 additions + 5 deletions
							expect(count).to.equal(10);

							done();
						})
						.catch(err => done(err));
				}
			});

			sm.on('kill', pid => {
				killedPid = pid;
			});

			const calls = [];
			for (let i = 0; i < 5; i++) {
				calls.push(sm.dispatcher.call('/spawn', {
					data: {
						command: process.execPath,
						args,
						options
					}
				}));
			}
		});

		it('should fail if spawn call is via http', done => {
			const sm = new SubprocessManager();

			sm.dispatcher
				.call('/spawn', {
					source: 'http',
					data: {
						command: process.execPath,
						args: path.join(__dirname, 'fixtures', 'node-version.js')
					}
				})
				.then(() => {
					done(new Error('Expected call to be forbidden'));
				})
				.catch(err => {
					try {
						expect(err).to.be.instanceof(SubprocessError);
						expect(err.toString()).to.equal('SubprocessError: Spawn not permitted (code 403)');
						expect(err.statusCode).to.equal(403);
						done();
					} catch (e) {
						done(e);
					}
				});
		});

		it('should fail if command does not exist', done => {
			const sm = new SubprocessManager();
			sm.dispatcher
				.call('/spawn', {
					data: {
						command: 'no_way_does_this_exist'
					}
				})
				.then(result => {
					done(new Error('Expected spawn call to fail'));
				})
				.catch(err => {
					expect(err.code).to.equal('ENOENT');
					done();
				});
		});
	});

	describe('Spawn Node', () => {
		beforeEach(() => {
			Dispatcher.root.routes = [];
		});

		afterEach(() => {
			Dispatcher.root.routes = [];
		});

		it('should spawn current Node version', function (done) {
			this.slow(120000);
			this.timeout(240000);

			const tmpDir = makeTempDir();
			Dispatcher.register('/appcd/config/home', ctx => {
				ctx.response = tmpDir;
			});

			const sm = new SubprocessManager();
			sm.dispatcher
				.call('/spawn/node', {
					data: {
						args: path.join(__dirname, 'fixtures', 'node-version.js')
					}
				})
				.then(result => {
					let stdout = '';
					result.response
						.on('data', data => {
							if (data.type === 'stdout') {
								stdout += data.output;
							}
						})
						.on('end', () => {
							try {
								expect(stdout.trim()).to.equal(process.version);
								done();
							} catch (e) {
								done(e);
							}
						});
				})
				.catch(done);
		});

		it('should spawn Node 6.9.5', function (done) {
			this.slow(120000);
			this.timeout(240000);

			const tmpDir = makeTempDir();
			Dispatcher.register('/appcd/config/home', ctx => {
				ctx.response = tmpDir;
			});

			const sm = new SubprocessManager();
			sm.dispatcher
				.call('/spawn/node/6.9.5', {
					data: {
						args: [ path.join(__dirname, 'fixtures', 'node-version.js') ]
					}
				})
				.then(result => {
					let stdout = '';
					result.response
						.on('data', data => {
							if (data.type === 'stdout') {
								stdout += data.output;
							}
						})
						.on('end', () => {
							try {
								expect(stdout.trim()).to.equal('v6.9.5');
								done();
							} catch (e) {
								done(e);
							}
						});
				})
				.catch(done);
		});

		it('should fail if spawn node call is via http', done => {
			const sm = new SubprocessManager();

			sm.dispatcher
				.call('/spawn/node', {
					source: 'http',
					data: {
						command: process.execPath,
						args: path.join(__dirname, 'fixtures', 'node-version.js')
					}
				})
				.then(() => {
					done(new Error('Expected call to be forbidden'));
				})
				.catch(err => {
					try {
						expect(err).to.be.instanceof(SubprocessError);
						expect(err.toString()).to.equal('SubprocessError: Spawn not permitted (code 403)');
						expect(err.statusCode).to.equal(403);
						done();
					} catch (e) {
						done(e);
					}
				});
		});
	});

	describe('Kill', () => {
		//
	});

	describe('Shutdown', () => {
		//
	});
});
