import appcdLogger from 'appcd-logger';
import Dispatcher from 'appcd-dispatcher';
import path from 'path';
import SubprocessError from '../dist/subprocess-error';
import SubprocessManager from '../dist/index';
import tmp from 'tmp';

import { sleep } from 'appcd-util';

const logger = appcdLogger('test:appcd:subprocess');

tmp.setGracefulCleanup();
function makeTempDir() {
	return tmp.dirSync({
		mode: '755',
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

		it('should spawn 5 sleep processes', async function () {
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

			await new Promise((resolve, reject) => {
				let count = 0;
				let killedPid = null;
				let calls = [];
				const subprocessMgr = new SubprocessManager();

				subprocessMgr.on('change', () => {
					count++;
				});

				subprocessMgr.on('spawn', async () => {
					if (count === 5) {
						try {
							let ctx = await subprocessMgr.call('/status');
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

							ctx = await subprocessMgr.call(`/kill/${pid}`);
							expect(ctx.response.toString()).to.equal('OK');
							expect(ctx.response.status).to.equal(200);
							expect(ctx.response.statusCode).to.equal(200);

							await sleep(100);

							expect(killedPid).to.equal(pid);

							ctx = await subprocessMgr.call('/status');
							expect(ctx.response).to.be.an.instanceof(Array);
							expect(ctx.response).to.have.lengthOf(4);

							// wait for the other 4 child processes to exit
							await Promise.all(calls);

							// there should have been 10 changes to the subprocesses array
							// 5 additions + 5 deletions
							expect(count).to.equal(10);
							resolve();
						} catch (err) {
							reject(err);
						}
					}
				});

				subprocessMgr.on('kill', pid => {
					killedPid = pid;
				});

				const spawn = async () => {
					const ctx = await subprocessMgr.call('/spawn', {
						data: {
							command: process.execPath,
							args,
							options
						}
					});

					calls.push(new Promise(resolve => {
						ctx.response.on('data', data => {
							if (data.type === 'exit') {
								resolve();
							}
						});
					}));
				};

				return Promise.all([ spawn(), spawn(), spawn(), spawn(), spawn() ]);
			});
		});

		it('should fail if spawn call is via http', async () => {
			const subprocessMgr = new SubprocessManager();

			try {
				await subprocessMgr.call('/spawn', {
					source: 'http',
					data: {
						command: process.execPath,
						args: path.join(__dirname, 'fixtures', 'node-version.js')
					}
				});
			} catch (err) {
				expect(err).to.be.instanceof(SubprocessError);
				expect(err.toString()).to.equal('SubprocessError: Spawn not permitted (code 403)');
				expect(err.statusCode).to.equal(403);
				return;
			}

			throw new Error('Expected call to be forbidden');
		});

		it('should fail if command does not exist', async () => {
			const subprocessMgr = new SubprocessManager();

			try {
				await subprocessMgr.call('/spawn', {
					data: {
						command: 'no_way_does_this_exist'
					}
				});
			} catch (err) {
				expect(err.code).to.equal('ENOENT');
				return;
			}

			throw new Error('Expected spawn call to fail');
		});

		it('should read stdout and stderr', async () => {
			const subprocessMgr = new SubprocessManager();

			const { response } = await subprocessMgr.call('/spawn', {
				data: {
					command: process.execPath,
					args: [ path.join(__dirname, 'fixtures', 'stdio.js') ]
				}
			});

			let output = '';
			response.on('data', data => {
				if (data.type === 'stdout' || data.type === 'stderr') {
					output += `${data.type} ${data.output}`; // note: output includes '\n'
				}
			});

			await new Promise((resolve, reject) => {
				response.on('end', () => {
					try {
						expect(output.trim()).to.equal('stdout Hello\nstderr World!');
						resolve();
					} catch (e) {
						reject(e);
					}
				});
			});
		});

		it('should return exit code 0', async () => {
			const subprocessMgr = new SubprocessManager();
			const { response } = await subprocessMgr.call('/spawn', {
				data: {
					command: process.execPath,
					args: [ path.join(__dirname, 'fixtures', 'exit-code.js') ],
					opts: { stdio: 'ignore' }
				}
			});

			let code = null;
			response.on('data', data => {
				if (data.type === 'exit') {
					code = data.code;
				}
			});

			await new Promise((resolve, reject) => {
				response.on('end', () => {
					try {
						expect(code).to.equal(0);
						resolve();
					} catch (e) {
						reject(e);
					}
				});
			});
		});

		it('should return exit code 1', async () => {
			const subprocessMgr = new SubprocessManager();
			const { response } = await subprocessMgr.call('/spawn', {
				data: {
					command: process.execPath,
					args: [ path.join(__dirname, 'fixtures', 'exit-code.js'), '1' ],
					opts: { stdio: 'ignore' }
				}
			});

			let code = null;
			response.on('data', data => {
				if (data.type === 'exit') {
					code = data.code;
				}
			});

			await new Promise((resolve, reject) => {
				response.on('end', () => {
					try {
						expect(code).to.equal(1);
						resolve();
					} catch (e) {
						reject(e);
					}
				});
			});
		});

		it('should fail if missing command', async () => {
			const subprocessMgr = new SubprocessManager();

			try {
				await subprocessMgr.call('/spawn');
			} catch (err) {
				expect(err.toString()).to.equal('SubprocessError: Missing required argument "command" (code 400.5)');
				return;
			}

			throw new Error('Expected error');
		});
	});

	describe('ipc', () => {
		it('should spawn a command with ipc', async function () {
			this.timeout(10000);
			this.slow(9000);

			const subprocessMgr = new SubprocessManager();
			const { proc, response } = await subprocessMgr.call('/spawn', {
				data: {
					command: process.execPath,
					args: [ path.join(__dirname, 'fixtures', 'ipc.js') ],
					ipc: true
				}
			});

			let counter = 0;

			await new Promise((resolve, reject) => {
				const finish = err => {
					proc.kill();
					err ? reject(err) : resolve();
				};

				proc.on('message', msg => {
					try {
						expect(msg).to.equal('bar!');
						finish();
					} catch (err) {
						finish(err);
					}
				});

				response.on('data', data => {
					try {
						switch (++counter) {
							case 1:
								expect(data.type).to.equal('spawn');
								break;

							case 2:
								expect(data.type).to.equal('stdout');
								expect(data.output).to.equal('hello from an ipc-enabled subprocess!\n');
								proc.send('foo!');
								break;

							case 3:
								expect(data.type).to.equal('stdout');
								expect(data.output).to.equal('got ipc message!\n');
								break;

							case 4:
								expect(data.type).to.equal('stdout');
								expect(data.output).to.equal('foo!\n');
						}
					} catch (err) {
						finish(err);
					}
				});
			});
		});

		it('should throw error if sending without ipc', async () => {
			const subprocessMgr = new SubprocessManager();

			const { proc } = await subprocessMgr.call('/spawn', {
				data: {
					command: process.execPath,
					args: [ path.join(__dirname, 'fixtures', 'node-version.js') ]
				}
			});

			expect(() => {
				proc.send('test!');
			}).to.throw(Error, 'IPC not enabled for this process');
		});

		it('should spawn a command with ipc and ignore stdout/stderr', async function () {
			this.timeout(5000);
			this.slow(3000);

			const subprocessMgr = new SubprocessManager();
			const { proc, response } = await subprocessMgr.call('/spawn', {
				data: {
					command: process.execPath,
					args: [ path.join(__dirname, 'fixtures', 'ipc.js') ],
					options: {
						stdio: 'ignore'
					},
					ipc: true
				}
			});

			await new Promise((resolve, reject) => {
				let counter = 0;
				const finish = err => {
					proc.kill();
					err ? reject(err) : resolve();
				};

				proc.on('message', msg => {
					try {
						expect(msg).to.equal('bar!');
						finish();
					} catch (err) {
						finish(err);
					}
				});

				response.on('data', data => {
					try {
						switch (++counter) {
							case 1:
								expect(data.type).to.equal('spawn');
								proc.send('foo!');
								break;
						}
					} catch (err) {
						finish(err);
					}
				});
			});
		});

		it('should spawn a command with ipc and custom stdio', async () => {
			const subprocessMgr = new SubprocessManager();
			const { proc, response } = await subprocessMgr.call('/spawn', {
				data: {
					command: process.execPath,
					args: [ path.join(__dirname, 'fixtures', 'ipc.js') ],
					options: {
						stdio: [ 'ignore', 'pipe' ]
					},
					ipc: true
				}
			});

			await new Promise((resolve, reject) => {
				let counter = 0;
				const finish = err => {
					proc.kill();
					err ? reject(err) : resolve();
				};

				proc.on('message', msg => {
					try {
						expect(msg).to.equal('bar!');
						finish();
					} catch (err) {
						finish(err);
					}
				});

				response.on('data', data => {
					try {
						switch (++counter) {
							case 1:
								expect(data.type).to.equal('spawn');
								proc.send('foo!');
								break;
						}
					} catch (err) {
						finish(err);
					}
				});
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

		it('should spawn current Node version', async function () {
			this.slow(120000);
			this.timeout(240000);

			const tmpDir = makeTempDir();
			Dispatcher.register('/appcd/config/home', ctx => {
				ctx.response = tmpDir;
			});

			const subprocessMgr = new SubprocessManager();
			const result = await subprocessMgr.call('/spawn/node', {
				data: {
					args: path.join(__dirname, 'fixtures', 'node-version.js')
				}
			});

			await new Promise((resolve, reject) => {
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
							resolve();
						} catch (e) {
							reject(e);
						}
					});
			});
		});

		it('should spawn Node 6.9.5', async function () {
			this.slow(120000);
			this.timeout(240000);

			const tmpDir = makeTempDir();
			Dispatcher.register('/appcd/config/home', ctx => {
				ctx.response = tmpDir;
			});

			const subprocessMgr = new SubprocessManager();
			const { response } = await subprocessMgr.call('/spawn/node/6.9.5', {
				data: {
					args: [ path.join(__dirname, 'fixtures', 'node-version.js') ]
				}
			});

			let stdout = '';
			response.on('data', data => {
				if (data.type === 'stdout') {
					stdout += data.output;
				}
			});

			await new Promise((resolve, reject) => {
				response.on('end', () => {
					try {
						expect(stdout.trim()).to.equal('v6.9.5');
						resolve();
					} catch (err) {
						reject(err);
					}
				});
			});
		});

		it('should fail if spawn node call is via http', async () => {
			const subprocessMgr = new SubprocessManager();

			try {
				await subprocessMgr.call('/spawn/node', {
					source: 'http',
					data: {
						command: process.execPath,
						args: path.join(__dirname, 'fixtures', 'node-version.js')
					}
				});
			} catch (err) {
				expect(err).to.be.instanceof(SubprocessError);
				expect(err.toString()).to.equal('SubprocessError: Spawn not permitted (code 403)');
				expect(err.statusCode).to.equal(403);
				return;
			}

			throw new Error('Expected call to be forbidden');
		});
	});

	describe('Kill', () => {
		it('should fail if missing pid', async () => {
			const subprocessMgr = new SubprocessManager();
			try {
				await subprocessMgr.call('/kill');
			} catch (err) {
				expect(err.toString()).to.equal('SubprocessError: Missing required parameter "pid" (code 400.3)');
				return;
			}

			throw new Error('Expected error');
		});

		it('should fail if pid is not a number', async () => {
			const subprocessMgr = new SubprocessManager();
			try {
				await subprocessMgr.call('/kill/it');
			} catch (err) {
				expect(err.toString()).to.equal('SubprocessError: The "pid" parameter must be a positive integer (code 400.4)');
				return;
			}

			throw new Error('Expected error');
		});

		it('should determine if pid is running', async () => {
			const subprocessMgr = new SubprocessManager();
			const { response } = await subprocessMgr.call(`/kill/${process.pid}`, { data: { signal: '0' } });
			expect(response.status).to.equal(200);
		});

		it('should determine if pid is not running', async () => {
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
			const { status } = await subprocessMgr.call(`/kill/${pid}`, { data: { signal: 0 } });
			expect(status).to.equal(404);
		});

		it('should error if signal is invalid', async () => {
			const subprocessMgr = new SubprocessManager();
			try {
				await subprocessMgr.call(`/kill/${process.pid}`, { data: { signal: 'foo' } });
			} catch (err) {
				expect(err.toString()).to.equal('SubprocessError: Unknown signal: foo');
				return;
			}

			throw new Error('Expected error');
		});
	});

	describe('Shutdown', () => {
		it('should shutdown when there are no subprocesses', () => {
			const subprocessMgr = new SubprocessManager();
			subprocessMgr.shutdown();
			expect(subprocessMgr.subprocesses).to.have.lengthOf(0);
		});

		it('should shutdown 2 spawned processes', async () => {
			const subprocessMgr = new SubprocessManager();

			await new Promise((resolve, reject) => {
				subprocessMgr.on('spawn', async () => {
					if (subprocessMgr.subprocesses.length === 1) {
						try {
							await subprocessMgr.shutdown();
							expect(subprocessMgr.subprocesses).to.have.lengthOf(0);
							resolve();
						} catch (err) {
							reject(err);
						}
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
		});

		it('should force kill subprocesses that are not exiting', async function () {
			this.timeout(8000);
			this.slow(8000);

			await new Promise((resolve, reject) => {
				const subprocessMgr = new SubprocessManager();

				subprocessMgr.on('spawn', async () => {
					await sleep(500);
					try {
						expect(subprocessMgr.subprocesses).to.have.lengthOf(1);
						await subprocessMgr.shutdown();
						expect(subprocessMgr.subprocesses).to.have.lengthOf(0);
						resolve();
					} catch (e) {
						reject(e);
					}
				});

				subprocessMgr.call('/spawn', {
					data: {
						command: process.execPath,
						args: [ path.join(__dirname, 'fixtures', 'ignore-sigterm.js') ]
					}
				});
			});
		});

		it('should shutdown if a subprocess has already exited', async () => {
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
			await new Promise((resolve, reject) => {
				subprocessMgr.on('spawn', p => {
					proc = p;
					proc.on('exit', () => {
						// put the dead proc back in the list... which you shouldn't actually do
						subprocessMgr.subprocesses.push(proc);

						subprocessMgr.shutdown()
							.then(() => resolve())
							.catch(reject);
					});
				});
			});
		});

		it('should kill the subprocess and all of its children', async function () {
			this.timeout(8000);
			this.slow(8000);

			const subprocessMgr = new SubprocessManager();

			const { response } = await subprocessMgr.call('/spawn', {
				data: {
					command: process.execPath,
					args: [
						path.join(__dirname, 'fixtures', 'spawn-sleep.js'),
						'5000'
					]
				}
			});

			let parentPid;
			let childPid;

			await new Promise((resolve, reject) => {
				response.on('data', async data => {
					if (data.type === 'spawn') {
						parentPid = data.pid;
						logger.log('Parent PID = %s', parentPid);
					} else if (data.type === 'stdout') {
						childPid = parseInt(data.output.trim());
						logger.log('Child PID = %s', childPid);
						if (childPid) {
							await subprocessMgr.shutdown();
							await sleep(250);

							// check that both pids are dead
							let dead = false;
							try {
								process.kill(childPid, 0);
							} catch (e) {
								dead = true;
							}

							if (!dead) {
								return reject(new Error('Child process didn\'t exit when parent did'));
							}

							dead = false;
							try {
								process.kill(parentPid, 0);
							} catch (e) {
								dead = true;
							}

							if (!dead) {
								return reject(new Error('Parent process didn\'t exit'));
							}

							resolve();
						}
					}
				});
			});
		});
	});
});
