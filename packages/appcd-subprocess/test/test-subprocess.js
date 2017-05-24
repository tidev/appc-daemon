import * as subprocess from '../dist/subprocess';
import path from 'path';
import SubprocessError from '../dist/subprocess-error';

const executable = `test${subprocess.exe}`;
const dir = path.join(__dirname, 'fixtures');
const fullpath = path.join(dir, executable);

describe('subprocess', () => {
	beforeEach(function () {
		this.PATH = process.env.PATH;
	});

	afterEach(function () {
		process.env.PATH = this.PATH;
	});

	describe('run()', () => {
		it('should run a subprocess that exits successfully', done => {
			subprocess
				.run(process.execPath, ['-e', 'process.stdout.write("foo");process.stderr.write("bar");process.exit(0);'])
				.then(({ stdout, stderr }) => {
					expect(stdout).to.equal('foo');
					expect(stderr).to.equal('bar');
					done();
				})
				.catch(done);
		});

		it('should run a subprocess that exits unsuccessfully', done => {
			subprocess
				.run(process.execPath, ['-e', 'process.stdout.write("foo");process.stderr.write("bar");process.exit(1);'])
				.then(({ stdout, stderr }) => {
					done(new Error('Expected subprocess to fail'));
				})
				.catch(({ code, stdout, stderr }) => {
					expect(code).to.equal(1);
					expect(stdout).to.equal('foo');
					expect(stderr).to.equal('bar');
					done();
				});
		});

		it('should ignore subprocess exit code and resolve successfully', done => {
			subprocess
				.run(
					process.execPath,
					['-e', 'process.exit(1);'],
					{ ignoreExitCode: true }
				)
				.then(({ code, stdout, stderr }) => {
					expect(code).to.equal(1);
					done();
				})
				.catch(done);
		});

		it('should run a subprocess without args and without options', done => {
			subprocess
				.run(fullpath)
				.then(({ stdout, stderr }) => {
					expect(stdout.trim()).to.equal('this is a test');
					expect(stderr.trim()).to.equal('');
					done();
				})
				.catch(done);
		});

		it('should run a subprocess without args and with options', done => {
			subprocess
				.run(fullpath, {})
				.then(({ code, stdout, stderr }) => {
					expect(stdout.trim()).to.equal('this is a test');
					expect(stderr.trim()).to.equal('');
					done();
				})
				.catch(done);
		});

		it('should run a command with an argument containing a space', done => {
			subprocess
				.run(process.execPath, [
					path.join(__dirname, 'fixtures', 'echo.js'),
					'Hello world!'
				])
				.then(({ stdout }) => {
					expect(stdout.trim()).to.equal('Hello world!');
					done();
				})
				.catch(done);
		});

		it('should fail if command is invalid', done => {
			subprocess
				.run()
				.then(() => {
					done(new Error('Expected error'));
				})
				.catch(err => {
					expect(err.message).to.equal('Expected command to be a non-empty string');
					done();
				})
				.catch(done);
		});

		it('should fail if options is not an object', done => {
			subprocess
				.run(process.execPath, [], 'foo')
				.then(() => {
					done(new Error('Expected error'));
				})
				.catch(err => {
					expect(err.message).to.equal('Expected options to be an object');
					done();
				})
				.catch(done);
		});

		it('should run with null options', done => {
			subprocess
				.run(fullpath, null)
				.then(({ code, stdout, stderr }) => {
					expect(stdout.trim()).to.equal('this is a test');
					expect(stderr.trim()).to.equal('');
					done();
				})
				.catch(done);
		});
	});

	describe('spawn()', () => {
		it('should error if params is invalid', () => {
			expect(() => {
				subprocess.spawn(null);
			}).to.throw(TypeError, 'Expected params to be an object');

			expect(() => {
				subprocess.spawn('foo');
			}).to.throw(TypeError, 'Expected params to be an object');
		});

		it('should error if command is invalid', () => {
			expect(() => {
				subprocess.spawn();
			}).to.throw(SubprocessError, 'Missing required argument "command"');

			expect(() => {
				subprocess.spawn({});
			}).to.throw(SubprocessError, 'Missing required argument "command"');

			expect(() => {
				subprocess.spawn({ command: '' });
			}).to.throw(SubprocessError, 'Spawn "command" must be a non-empty string');

			expect(() => {
				subprocess.spawn({ command: 123 });
			}).to.throw(SubprocessError, 'Spawn "command" must be a non-empty string');
		});

		it('should error if arguments is invalid', () => {
			expect(() => {
				subprocess.spawn({ command: 'foo', args: null });
			}).to.throw(SubprocessError, 'Spawn "arguments" must be an array');

			expect(() => {
				subprocess.spawn({ command: 'foo', args: '' });
			}).to.throw(SubprocessError, 'Spawn "arguments" must be an array');
		});

		it('should error if options is invalid', () => {
			expect(() => {
				subprocess.spawn({ command: 'foo', args: [], options: null });
			}).to.throw(SubprocessError, 'Spawn "options" must be an object');

			expect(() => {
				subprocess.spawn({ command: 'foo', args: [], options: 'bar' });
			}).to.throw(SubprocessError, 'Spawn "options" must be an object');
		});

		it('should spawn a command', done => {
			const desc = subprocess.spawn({
				command: process.execPath,
				args: [
					path.join(__dirname, 'fixtures', 'echo.js'),
					'Hello world!'
				],
				options: { cwd: __dirname }
			});

			expect(desc).to.be.an.Object;
			expect(desc).to.have.keys('command', 'args', 'options', 'child');

			let stdout = '';
			let stderr = '';

			desc.child.stdout.on('data', data => { stdout += data.toString(); });
			desc.child.stderr.on('data', data => { stderr += data.toString(); });

			desc.child.on('close', code => {
				try {
					expect(stdout.trim()).to.equal('Hello world!');
					expect(stderr.trim()).to.equal('');
					expect(code).to.equal(0);
					done();
				} catch (e) {
					done(e);
				}
			});
		});
	});

	describe('which()', () => {
		it('should find a well-known executable', done => {
			process.env.PATH = path.join(__dirname, 'fixtures');
			subprocess.which(executable)
				.then(result => {
					expect(result).to.be.a.String;
					expect(result).to.equal(fullpath);
					done();
				})
				.catch(done);
		});

		it('should not find an invalid executable', done => {
			subprocess.which('no_way_does_this_already_exist')
				.then(executable => {
					done(new Error(`Somehow there's an executable called "${executable}"`));
				})
				.catch(err => {
					expect(err).to.be.instanceof(Error);
					done();
				});
		});

		it('should scan list of executables and find well-known executable', done => {
			process.env.PATH = path.join(__dirname, 'fixtures');
			subprocess.which(['no_way_does_this_already_exist', executable])
				.then(result => {
					expect(result).to.be.a.String;
					expect(result).to.equal(fullpath);
					done();
				})
				.catch(done);
		});

		it('should scan list of invalid executables', done => {
			subprocess.which(['no_way_does_this_already_exist', null, 'this_also_should_not_exist'])
				.then(executable => {
					done(new Error(`Somehow there's an executable called "${executable}"`));
				})
				.catch(err => {
					expect(err).to.be.instanceof(Error);
					done();
				});
		});
	});
});
