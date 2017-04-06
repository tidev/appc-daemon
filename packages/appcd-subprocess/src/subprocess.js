import snooplogg, { styles } from 'snooplogg';
import SubprocessError from './subprocess-error';
import _which from 'which';

import { spawn as _spawn } from 'child_process';

const { codes } = SubprocessError;

const isWindows = process.platform === 'win32';

const logger = snooplogg.config({ theme: 'detailed' })('appcd:subprocess');
const { highlight } = snooplogg.styles;

export const exe = (isWindows ? '.exe' : '');
export const cmd = (isWindows ? '.cmd' : '');
export const bat = (isWindows ? '.bat' : '');

/**
 * Runs a command, waits for it to finish, then returns the result.
 *
 * @param {String} cmd - The command to spawn.
 * @param {Array} [args] - An array of arguments to pass to the subprocess.
 * @param {Object} [opts] - Spawn options.
 * @returns {Promise} Resolves the stdout and stderr output.
 */
export function run(cmd, args, opts) {
	if (args && !Array.isArray(args)) {
		opts = args;
		args = [];
	}

	return new Promise((resolve, reject) => {
		logger.log('Executing: %s', `${styles.highlight(cmd + (args ? args.map(a => a.indexOf(' ') !== -1 ? ` "${a}"` : ` ${a}`).join('') : ''))}`);

		const child = _spawn(cmd, args, opts);

		let stdout = '';
		let stderr = '';

		child.stdout.on('data', data => stdout += data.toString());
		child.stderr.on('data', data => stderr += data.toString());

		child.on('close', code => {
			if (!code) {
				resolve({ stdout, stderr });
			} else {
				const err = new Error(`Subprocess exited with code ${code}`);
				err.command = cmd;
				err.args    = args;
				err.code    = code;
				err.stdout  = stdout;
				err.stderr  = stderr;
				reject(err);
			}
		});
	});
}

/**
 * Spawns a subprocess.
 *
 * @param {Object} params - Various parameters.
 * @param {String} params.command - The command to run.
 * @param {Array} [params.args] - An array of arguments to pass into the command.
 * @param {Object} [params.options] - Various spawn params. These
 * @returns {ChildProcess}
 */
export function spawn(params = {}) {
	if (!params || typeof params !== 'object') {
		throw new TypeError('Expected params to be an object');
	}

	if (!params.hasOwnProperty('command')) {
		throw new SubprocessError(codes.MISSING_ARGUMENT, 'Missing required argument "%s"', 'command');
	}
	if (!params.command || typeof params.command !== 'string') {
		throw new SubprocessError(codes.INVALID_ARGUMENT, 'Spawn "command" must be a non-empty string');
	}

	let args = [];
	if (params.hasOwnProperty('args')) {
		if (Array.isArray(params.args)) {
			args = params.args;
		} else if (params.args) {
			args = [ params.args ];
		} else {
			throw new SubprocessError(codes.INVALID_ARGUMENT, 'Spawn "arguments" must be an array');
		}
	}

	// we scrub the supplied options for only allowed options
	const options = {};

	if (params.hasOwnProperty('options')) {
		if (!params.options || typeof params.options !== 'object') {
			throw new SubprocessError(codes.INVALID_ARGUMENT, 'Spawn "options" must be an object');
		}

		for (const prop of ['cwd', 'env', 'stdio']) {
			if (params.options.hasOwnProperty(prop)) {
				options[prop] = params.options[prop];
			}
		}
	}

	logger.log('Executing: %s %s', highlight(params.command), highlight(args.map(a => typeof a === 'string' && a.indexOf(' ') !== -1 ? `"${a}"` : a).join(' ')));

	return {
		command: params.command,
		args,
		options,
		child: _spawn(params.command, args, options)
	};
}

/**
 * Wraps `which()` with a promise.
 *
 * @param {String|Array.<String>} executables - An array of executables to search
 * until it finds a valid executable.
 * @returns {Promise} Resolves the specified executable.
 */
export function which(executables) {
	if (!Array.isArray(executables)) {
		executables = [ executables ];
	}

	return Promise.resolve()
		.then(function next() {
			const executable = executables.shift();

			if (!executable) {
				return executables.length ? next() : Promise.reject(new Error('Unable to find executable'));
			}

			return new Promise((resolve, reject) => {
				_which(executable, (err, file) => {
					if (err) {
						next().then(resolve).catch(reject);
					} else {
						resolve(file);
					}
				});
			});
		});
}
