import Dispatcher from 'appcd-dispatcher';
import path from 'path';
import snooplogg from 'snooplogg';
import SubprocessError from '../src/subprocess-error';
import SubprocessManager from '../src/index';
import tmp from 'tmp';

const logger = snooplogg.config({ theme: 'detailed' })('test');

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
			let wait = Promise.resolve();

			sm.on('change', (obj, src) => {
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
								expect(desc).to.have.any.keys('pid', 'command', 'args', 'options', 'startTime');
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
										setTimeout(() => {
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
										}, 100);
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
				sm.dispatcher
					.call('/spawn', {
						data: {
							command: process.execPath,
							args,
							options
						}
					})
					.then(ctx => {
						calls.push(new Promise((resolve, reject) => {
							ctx.response.on('data', data => {
								if (data.type === 'exit') {
									resolve();
								}
							});
						}));
					})
					.catch(err => {
						calls.push(Promise.resolve());
					});
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

		it('should read stdout and stderr', done => {
			const sm = new SubprocessManager();
			sm.dispatcher
				.call('/spawn', {
					data: {
						command: process.execPath,
						args: [ path.join(__dirname, 'fixtures', 'stdio.js') ]
					}
				})
				.then(result => {
					let output = '';
					result.response
						.on('data', data => {
							if (data.type === 'stdout' || data.type === 'stderr') {
								output += `${data.type} ${data.output}`; // note: output includes '\n'
							}
						})
						.on('end', () => {
							try {
								expect(output.trim()).to.equal('stdout Hello\nstderr World!');
								done();
							} catch (e) {
								done(e);
							}
						});
				})
				.catch(done);
		});

		it('should return exit code 0', done => {
			const sm = new SubprocessManager();
			sm.dispatcher
				.call('/spawn', {
					data: {
						command: process.execPath,
						args: [ path.join(__dirname, 'fixtures', 'exit-code.js') ],
						opts: { stdio: 'ignore' }
					}
				})
				.then(result => {
					let code = null;
					result.response
						.on('data', data => {
							if (data.type === 'exit') {
								code = data.code;
							}
						})
						.on('end', () => {
							try {
								expect(code).to.equal(0);
								done();
							} catch (e) {
								done(e);
							}
						});
				})
				.catch(done);
		});

		it('should return exit code 1', done => {
			const sm = new SubprocessManager();
			sm.dispatcher
				.call('/spawn', {
					data: {
						command: process.execPath,
						args: [ path.join(__dirname, 'fixtures', 'exit-code.js'), '1' ],
						opts: { stdio: 'ignore' }
					}
				})
				.then(result => {
					let code = null;
					result.response
						.on('data', data => {
							if (data.type === 'exit') {
								code = data.code;
							}
						})
						.on('end', () => {
							try {
								expect(code).to.equal(1);
								done();
							} catch (e) {
								done(e);
							}
						});
				})
				.catch(done);
		});

		it('should fail if missing command', done => {
			const sm = new SubprocessManager();
			sm.dispatcher
				.call('/spawn')
				.then(result => {
					done(new Error('Expected error'));
				})
				.catch(err => {
					expect(err.toString()).to.equal('SubprocessError: Missing required argument "command" (code 400.5)');
					done();
				})
				.catch(done);
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
		it('should fail if missing pid', done => {
			const sm = new SubprocessManager();
			sm.dispatcher
				.call('/kill')
				.then(result => {
					done(new Error('Expected error'));
				})
				.catch(err => {
					expect(err.toString()).to.equal('SubprocessError: Missing required parameter "pid" (code 400.3)');
					done();
				})
				.catch(done);
		});

		it('should fail if pid is not a number', done => {
			const sm = new SubprocessManager();
			sm.dispatcher
				.call('/kill/it')
				.then(result => {
					done(new Error('Expected error'));
				})
				.catch(err => {
					expect(err.toString()).to.equal('SubprocessError: The "pid" parameter must be a positive integer (code 400.4)');
					done();
				})
				.catch(done);
		});

		it('should determine if pid is running', done => {
			const sm = new SubprocessManager();
			sm.dispatcher
				.call(`/kill/${process.pid}`, { data: { signal: '0' } })
				.then(result => {
					expect(result.response.status).to.equal(200);
					done();
				})
				.catch(done);
		});

		it('should determine if pid is not running', done => {
			let pid = 64000;

			while (true) {
				try {
					process.kill(pid, 0);
					pid--;
				} catch (e) {
					break;
				}
			}

			const sm = new SubprocessManager();
			sm.dispatcher
				.call(`/kill/${pid}`, { data: { signal: 0 } })
				.then(result => {
					expect(result.status).to.equal(404);
					done();
				})
				.catch(done);
		});

		it('should error if signal is invalid', done => {
			const sm = new SubprocessManager();
			sm.dispatcher
				.call(`/kill/${process.pid}`, { data: { signal: 'foo' } })
				.then(result => {
					done(new Error('Expected error'));
				})
				.catch(err => {
					expect(err.toString()).to.equal('SubprocessError: Unknown signal: foo');
					done();
				});
		});
	});

	describe('Shutdown', () => {
		it('should shutdown when there are no subprocesses', () => {
			const sm = new SubprocessManager();
			sm.shutdown();
			expect(sm.subprocesses).to.have.lengthOf(0);
		});

		it('should shutdown 2 spawned processes', done => {
			const sm = new SubprocessManager();

			sm.on('spawn', proc => {
				if (sm.subprocesses.length === 1) {
					sm.shutdown()
						.then(() => {
							expect(sm.subprocesses).to.have.lengthOf(0);
							done();
						})
						.catch(done);
				}
			});

			for (let i = 0; i < 1; i++) {
				sm.dispatcher.call('/spawn', {
					data: {
						command: process.execPath,
						args: [
							path.join(__dirname, 'fixtures', 'sleep.js'),
							'200000'
						],
						opts: { stdio: 'ignore' }
					}
				});
			}
		});

		it('should force kill subprocesses that are not exiting', function (done) {
			this.timeout(8000);
			this.slow(8000);

			const sm = new SubprocessManager();

			sm.on('spawn', proc => {
				setTimeout(async () => {
					try {
						expect(sm.subprocesses).to.have.lengthOf(1);
						await sm.shutdown();
						expect(sm.subprocesses).to.have.lengthOf(0);
						done();
					} catch (e) {
						done(e);
					}
				}, 500);
			});

			sm.dispatcher.call('/spawn', {
				data: {
					command: process.execPath,
					args: [ path.join(__dirname, 'fixtures', 'ignore-sigterm.js') ]
				}
			});
		});

		it('should shutdown if a subprocess has already exited', done => {
			const sm = new SubprocessManager();

			sm.dispatcher.call('/spawn', {
				data: {
					command: process.execPath,
					args: [
						path.join(__dirname, 'fixtures', 'node-version.js')
					],
					opts: { stdio: 'ignore' }
				}
			});

			let proc;
			sm.on('spawn', p => {
				proc = p;
				proc.on('exit', code => {
					// put the dead proc back in the list... which you shouldn't actually do
					sm.subprocesses.push(proc);

					sm.shutdown()
						.then(() => done())
						.catch(done);
				});
			});
		});

		it('should kill the subprocess and all of its children', function (done) {
			this.timeout(8000);
			this.slow(8000);

			const sm = new SubprocessManager();

			sm.dispatcher
				.call('/spawn', {
					data: {
						command: process.execPath,
						args: [
							path.join(__dirname, 'fixtures', 'spawn-sleep.js'),
							'5000'
						]
					}
				})
				.then(ctx => {
					let parentPid;
					let childPid;

					ctx.response.on('data', data => {
						if (data.type === 'spawn') {
							parentPid = data.pid;
							logger.log('Parent PID = %s', parentPid);
						} else if (data.type === 'stdout') {
							childPid = parseInt(data.output.trim());
							logger.log('Child PID = %s', childPid);
							if (childPid) {
								sm.shutdown()
									.then(() => {
										setTimeout(() => {
											// check that both pids are dead
											let dead = false;
											try {
												process.kill(childPid, 0);
											} catch (e) {
												dead = true;
											}

											if (!dead) {
												return done(new Error('Child process didn\'t exit when parent did'));
											}

											dead = false;
											try {
												process.kill(parentPid, 0);
											} catch (e) {
												dead = true;
											}

											if (!dead) {
												return done(new Error('Parent process didn\'t exit'));
											}

											done();
										}, 250);
									})
									.catch(done);
							}
						}
					});
				})
				.catch(done);
		});
	});
});
