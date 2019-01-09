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
		it('should run a subprocess that exits successfully', async () => {
			const { stdout, stderr } = await subprocess.run(process.execPath, [ '-e', 'process.stdout.write("foo");process.stderr.write("bar");process.exit(0);' ]);
			expect(stdout).to.equal('foo');
			expect(stderr).to.equal('bar');
		});

		it('should run a subprocess that exits unsuccessfully', async () => {
			try {
				await subprocess.run(process.execPath, [ '-e', 'process.stdout.write("foo");process.stderr.write("bar");process.exit(1);' ]);
			} catch ({ code, stdout, stderr }) {
				expect(code).to.equal(1);
				expect(stdout).to.equal('foo');
				expect(stderr).to.equal('bar');
				return;
			}

			throw new Error('Expected subprocess to fail');
		});

		it('should ignore subprocess exit code and resolve successfully', async () => {
			const { code } = await subprocess.run(process.execPath, [ '-e', 'process.exit(1);' ], { ignoreExitCode: true });
			expect(code).to.equal(1);
		});

		it('should run a subprocess without args and without options', async () => {
			const { stdout, stderr } = await subprocess.run(fullpath);
			expect(stdout.trim()).to.equal('this is a test');
			expect(stderr.trim()).to.equal('');
		});

		it('should run a subprocess without args and with options', async () => {
			const { stdout, stderr } = await subprocess.run(fullpath, {});
			expect(stdout.trim()).to.equal('this is a test');
			expect(stderr.trim()).to.equal('');
		});

		it('should run a command with an argument containing a space', async () => {
			const { stdout } = await subprocess.run(process.execPath, [
				path.join(__dirname, 'fixtures', 'echo.js'),
				'Hello world!'
			]);
			expect(stdout.trim()).to.equal('Hello world!');
		});

		it('should fail if command is invalid', async () => {
			try {
				await subprocess.run();
			} catch (err) {
				expect(err.message).to.equal('Expected command to be a non-empty string');
				return;
			}

			throw new Error('Expected error');
		});

		it('should fail if options is not an object', async () => {
			try {
				await subprocess.run(process.execPath, [], 'foo');
			} catch (err) {
				expect(err.message).to.equal('Expected options to be an object');
				return;
			}

			throw new Error('Expected error');
		});

		it('should run with null options', async () => {
			const { stdout, stderr } = await subprocess.run(fullpath, null);
			expect(stdout.trim()).to.equal('this is a test');
			expect(stderr.trim()).to.equal('');
		});

		it('should default to opts.windowsHide: true when not specified', async () => {
			try {
				await subprocess.run(process.execPath, [ '-e', 'process.stdout.write("foo");process.stderr.write("bar");process.exit(1);' ]);
			} catch (err) {
				expect(err.opts).to.be.an('object');
				expect(err.opts.windowsHide).to.equal(true);
				return;
			}

			throw new Error('Expected subprocess to fail');
		});

		it('should not override opts.windowsHide when specified', async () => {
			try {
				await subprocess.run(process.execPath, [ '-e', 'process.stdout.write("foo");process.stderr.write("bar");process.exit(1);' ], { windowsHide: false });
			} catch (err) {
				expect(err.opts).to.be.an('object');
				expect(err.opts.windowsHide).to.equal(false);
				return;
			}

			throw new Error('Expected subprocess to fail');
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

		it('should spawn a command', function (done) {
			this.timeout(20000);
			this.slow(19000);

			const desc = subprocess.spawn({
				command: process.execPath,
				args: [
					path.join(__dirname, 'fixtures', 'echo.js'),
					'Hello world!'
				],
				options: { cwd: __dirname }
			});

			expect(desc).to.be.an('object');
			expect(desc).to.have.keys('command', 'args', 'options', 'child');

			let stdout = '';
			let stderr = '';

			desc.child.stdout.on('data', data => {
				stdout += data.toString();
			});

			desc.child.stderr.on('data', data => {
				stderr += data.toString();
			});

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

		it('should default to opts.windowsHide: true when not specified', done => {
			const desc = subprocess.spawn({
				command: process.execPath,
				args: [
					path.join(__dirname, 'fixtures', 'echo.js'),
					'Hello world!'
				],
				options: { cwd: __dirname }
			});

			expect(desc).to.be.an('object');
			expect(desc).to.have.keys('command', 'args', 'options', 'child');
			expect(desc.options.windowsHide).to.equal(true);
			done();
		});

		it('should not override opts.windowsHide when specified', done => {
			const desc = subprocess.spawn({
				command: process.execPath,
				args: [
					path.join(__dirname, 'fixtures', 'echo.js'),
					'Hello world!'
				],
				options: { cwd: __dirname, windowsHide: false }
			});

			expect(desc).to.be.an('object');
			expect(desc).to.have.keys('command', 'args', 'options', 'child');
			expect(desc.options.windowsHide).to.equal(false);
			done();
		});
	});

	describe('which()', () => {
		it('should find a well-known executable', async () => {
			process.env.PATH = path.join(__dirname, 'fixtures');
			const result = await subprocess.which(executable);
			expect(result).to.be.a('string');
			expect(result).to.equal(fullpath);
		});

		it('should not find an invalid executable', async () => {
			let executable;

			try {
				executable = await subprocess.which('no_way_does_this_already_exist');
			} catch (err) {
				expect(err).to.be.instanceof(Error);
				return;
			}

			throw new Error(`Somehow there's an executable called "${executable}"`);
		});

		it('should scan list of executables and find well-known executable', async () => {
			process.env.PATH = path.join(__dirname, 'fixtures');
			const result = await subprocess.which([ 'no_way_does_this_already_exist', executable ]);
			expect(result).to.be.a('string');
			expect(result).to.equal(fullpath);
		});

		it('should scan list of invalid executables', async () => {
			let executable;

			try {
				executable = await subprocess.which([ 'no_way_does_this_already_exist', null, 'this_also_should_not_exist' ]);
			} catch (err) {
				expect(err).to.be.instanceof(Error);
				return;
			}

			throw new Error(`Somehow there's an executable called "${executable}"`);
		});
	});
});
