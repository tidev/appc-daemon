import appcdLogger from 'appcd-logger';
import Dispatcher from 'appcd-dispatcher';
import path from 'path';
import SubprocessError from '../dist/subprocess-error';
import SubprocessManager from '../dist/index';
import tmp from 'tmp';

const logger = appcdLogger('test:appcd:subprocess');

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
				stdio: 'ignore',
				windowsHide: false
			};
			const subprocessMgr = new SubprocessManager();
			let count = 0;
			let killedPid = null;

			subprocessMgr.on('change', () => {
				count++;
			});

			subprocessMgr.on('spawn', () => {
				if (count === 5) {
					subprocessMgr
						.call('/status')
						.then(ctx => {
							expect(ctx.response).to.be.an.instanceof(Array);
							expect(ctx.response).to.have.lengthOf(5);

							for (const desc of ctx.response) {
								expect(desc).to.be.an('object');
								expect(desc).to.have.any.keys('pid', 'command', 'args', 'options', 'startTime');
								expect(desc.pid).to.be.a('number');
								expect(desc.pid).to.be.at.least(1);
								expect(desc.command).to.equal(process.execPath);
								expect(desc.args).to.deep.equal(args);
								expect(desc.options).to.deep.equal(options);
								expect(desc.startTime).to.be.an.instanceof(Date);
							}

							const { pid } = ctx.response[0];

							return subprocessMgr
								.call(`/kill/${pid}`)
								.then(ctx => {
									expect(ctx.response.toString()).to.equal('OK');
									expect(ctx.response.status).to.equal(200);
									expect(ctx.response.statusCode).to.equal(200);

									return new Promise((resolve, reject) => {
										setTimeout(() => {
											expect(killedPid).to.equal(pid);

											subprocessMgr
												.call('/status')
												.then(ctx => {
													expect(ctx.response).to.be.an.instanceof(Array);
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

			subprocessMgr.on('kill', pid => {
				killedPid = pid;
			});

			const calls = [];
			for (let i = 0; i < 5; i++) {
				subprocessMgr
					.call('/spawn', {
						data: {
							command: process.execPath,
							args,
							options
						}
					})
					.then(ctx => {
						calls.push(new Promise(resolve => {
							ctx.response.on('data', data => {
								if (data.type === 'exit') {
									resolve();
								}
							});
						}));
					})
					.catch(() => {
						calls.push(Promise.resolve());
					});
			}
		});

		it('should fail if spawn call is via http', done => {
			const subprocessMgr = new SubprocessManager();

			subprocessMgr
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
			const subprocessMgr = new SubprocessManager();
			subprocessMgr
				.call('/spawn', {
					data: {
						command: 'no_way_does_this_exist'
					}
				})
				.then(() => {
					done(new Error('Expected spawn call to fail'));
				})
				.catch(err => {
					expect(err.code).to.equal('ENOENT');
					done();
				});
		});

		it('should read stdout and stderr', done => {
			const subprocessMgr = new SubprocessManager();
			subprocessMgr
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
			const subprocessMgr = new SubprocessManager();
			subprocessMgr
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
			const subprocessMgr = new SubprocessManager();
			subprocessMgr
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
			const subprocessMgr = new SubprocessManager();
			subprocessMgr
				.call('/spawn')
				.then(() => {
					done(new Error('Expected error'));
				})
				.catch(err => {
					expect(err.toString()).to.equal('SubprocessError: Missing required argument "command" (code 400.5)');
					done();
				})
				.catch(done);
		});
	});

	describe('ipc', () => {
		it('should spawn a command with ipc', done => {
			const subprocessMgr = new SubprocessManager();
			subprocessMgr
				.call('/spawn', {
					data: {
						command: process.execPath,
						args: [ path.join(__dirname, 'fixtures', 'ipc.js') ],
						ipc: true
					}
				})
				.then(result => {
					let counter = 0;

					function finish(e) {
						result.proc.kill();
						done(e);
					}

					result.proc.on('message', msg => {
						try {
							expect(msg).to.equal('bar!');
							finish();
						} catch (e) {
							finish(e);
						}
					});

					result.response
						.on('data', data => {
							try {
								switch (++counter) {
									case 1:
										expect(data.type).to.equal('spawn');
										break;

									case 2:
										expect(data.type).to.equal('stdout');
										expect(data.output).to.equal('hello from an ipc-enabled subprocess!\n');
										result.proc.send('foo!');
										break;

									case 3:
										expect(data.type).to.equal('stdout');
										expect(data.output).to.equal('got ipc message!\n');
										break;

									case 4:
										expect(data.type).to.equal('stdout');
										expect(data.output).to.equal('foo!\n');
								}
							} catch (e) {
								finish(e);
							}
						});
				})
				.catch(done);
		});

		it('should throw error if sending without ipc', done => {
			const subprocessMgr = new SubprocessManager();
			subprocessMgr
				.call('/spawn', {
					data: {
						command: process.execPath,
						args: [ path.join(__dirname, 'fixtures', 'node-version.js') ]
					}
				})
				.then(result => {
					expect(() => {
						result.proc.send('test!');
					}).to.throw(Error, 'IPC not enabled for this process');

					done();
				})
				.catch(done);
		});

		it('should spawn a command with ipc and ignore stdout/stderr', done => {
			const subprocessMgr = new SubprocessManager();
			subprocessMgr
				.call('/spawn', {
					data: {
						command: process.execPath,
						args: [ path.join(__dirname, 'fixtures', 'ipc.js') ],
						options: {
							stdio: 'ignore'
						},
						ipc: true
					}
				})
				.then(result => {
					let counter = 0;

					function finish(e) {
						result.proc.kill();
						done(e);
					}

					result.proc.on('message', msg => {
						try {
							expect(msg).to.equal('bar!');
							finish();
						} catch (e) {
							finish(e);
						}
					});

					result.response
						.on('data', data => {
							try {
								switch (++counter) {
									case 1:
										expect(data.type).to.equal('spawn');
										result.proc.send('foo!');
										break;
								}
							} catch (e) {
								finish(e);
							}
						});
				})
				.catch(done);
		});

		it('should spawn a command with ipc and custom stdio', done => {
			const subprocessMgr = new SubprocessManager();
			subprocessMgr
				.call('/spawn', {
					data: {
						command: process.execPath,
						args: [ path.join(__dirname, 'fixtures', 'ipc.js') ],
						options: {
							stdio: [ 'ignore', 'pipe' ]
						},
						ipc: true
					}
				})
				.then(result => {
					let counter = 0;

					function finish(e) {
						result.proc.kill();
						done(e);
					}

					result.proc.on('message', msg => {
						try {
							expect(msg).to.equal('bar!');
							finish();
						} catch (e) {
							finish(e);
						}
					});

					result.response
						.on('data', data => {
							try {
								switch (++counter) {
									case 1:
										expect(data.type).to.equal('spawn');
										result.proc.send('foo!');
										break;
								}
							} catch (e) {
								finish(e);
							}
						});
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

			const subprocessMgr = new SubprocessManager();
			subprocessMgr
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

			const subprocessMgr = new SubprocessManager();
			subprocessMgr
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
			const subprocessMgr = new SubprocessManager();

			subprocessMgr
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
			const subprocessMgr = new SubprocessManager();
			subprocessMgr
				.call('/kill')
				.then(() => {
					done(new Error('Expected error'));
				})
				.catch(err => {
					expect(err.toString()).to.equal('SubprocessError: Missing required parameter "pid" (code 400.3)');
					done();
				})
				.catch(done);
		});

		it('should fail if pid is not a number', done => {
			const subprocessMgr = new SubprocessManager();
			subprocessMgr
				.call('/kill/it')
				.then(() => {
					done(new Error('Expected error'));
				})
				.catch(err => {
					expect(err.toString()).to.equal('SubprocessError: The "pid" parameter must be a positive integer (code 400.4)');
					done();
				})
				.catch(done);
		});

		it('should determine if pid is running', done => {
			const subprocessMgr = new SubprocessManager();
			subprocessMgr
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

			const subprocessMgr = new SubprocessManager();
			subprocessMgr
				.call(`/kill/${pid}`, { data: { signal: 0 } })
				.then(result => {
					expect(result.status).to.equal(404);
					done();
				})
				.catch(done);
		});

		it('should error if signal is invalid', done => {
			const subprocessMgr = new SubprocessManager();
			subprocessMgr
				.call(`/kill/${process.pid}`, { data: { signal: 'foo' } })
				.then(() => {
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
			const subprocessMgr = new SubprocessManager();
			subprocessMgr.shutdown();
			expect(subprocessMgr.subprocesses).to.have.lengthOf(0);
		});

		it('should shutdown 2 spawned processes', done => {
			const subprocessMgr = new SubprocessManager();

			subprocessMgr.on('spawn', () => {
				if (subprocessMgr.subprocesses.length === 1) {
					subprocessMgr.shutdown()
						.then(() => {
							expect(subprocessMgr.subprocesses).to.have.lengthOf(0);
							done();
						})
						.catch(done);
				}
			});

			for (let i = 0; i < 1; i++) {
				subprocessMgr.call('/spawn', {
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

			const subprocessMgr = new SubprocessManager();

			subprocessMgr.on('spawn', () => {
				setTimeout(async () => {
					try {
						expect(subprocessMgr.subprocesses).to.have.lengthOf(1);
						await subprocessMgr.shutdown();
						expect(subprocessMgr.subprocesses).to.have.lengthOf(0);
						done();
					} catch (e) {
						done(e);
					}
				}, 500);
			});

			subprocessMgr.call('/spawn', {
				data: {
					command: process.execPath,
					args: [ path.join(__dirname, 'fixtures', 'ignore-sigterm.js') ]
				}
			});
		});

		it('should shutdown if a subprocess has already exited', done => {
			const subprocessMgr = new SubprocessManager();

			subprocessMgr.call('/spawn', {
				data: {
					command: process.execPath,
					args: [
						path.join(__dirname, 'fixtures', 'node-version.js')
					],
					opts: { stdio: 'ignore' }
				}
			});

			let proc;
			subprocessMgr.on('spawn', p => {
				proc = p;
				proc.on('exit', () => {
					// put the dead proc back in the list... which you shouldn't actually do
					subprocessMgr.subprocesses.push(proc);

					subprocessMgr.shutdown()
						.then(() => done())
						.catch(done);
				});
			});
		});

		it('should kill the subprocess and all of its children', function (done) {
			this.timeout(8000);
			this.slow(8000);

			const subprocessMgr = new SubprocessManager();

			subprocessMgr
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
								subprocessMgr.shutdown()
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
