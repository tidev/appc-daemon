import appcdLogger from 'appcd-logger';
import SubprocessError from './subprocess-error';
import _which from 'which';

import { spawn as _spawn } from 'child_process';

const { codes } = SubprocessError;

const isWindows = process.platform === 'win32';

const logger = appcdLogger('appcd:subprocess');
const { highlight } = appcdLogger.styles;

export const exe = (isWindows ? '.exe' : '');
export const cmd = (isWindows ? '.cmd' : '');
export const bat = (isWindows ? '.bat' : '');

/**
 * Runs a command, waits for it to finish, then returns the result.
 *
 * @param {String} cmd - The command to spawn.
 * @param {Array} [args] - An array of arguments to pass to the subprocess.
 * @param {Object} [opts] - Spawn options.
 * @param {Boolean} [opts.ignoreExitCode=false] - When true, resolves the promise even if the
 * process returns an exit code greater than or equal to one.
 * @returns {Promise} Resolves the stdout and stderr output.
 */
export function run(cmd, args, opts) {
	return new Promise((resolve, reject) => {
		if (!cmd || typeof cmd !== 'string') {
			throw new TypeError('Expected command to be a non-empty string');
		}

		if (opts && typeof opts !== 'object') {
			throw new TypeError('Expected options to be an object');
		} else if (!opts && typeof args === 'object' && !Array.isArray(args)) {
			opts = args;
			args = [];
		}

		if (!opts) {
			opts = {};
		}

		if (!Object.prototype.hasOwnProperty.call(opts, 'windowsHide')) {
			opts.windowsHide = true;
		}

		logger.log('Executing: %s %s', highlight(cmd), highlight(prettyArgs(args)));

		const child = _spawn(cmd, args, opts);

		let stdout = '';
		let stderr = '';

		child.stdout.on('data', data => stdout += data.toString());
		child.stderr.on('data', data => stderr += data.toString());

		child.on('close', code => {
			if (!code || opts.ignoreExitCode) {
				resolve({ code, stdout, stderr });
			} else {
				const err = new Error(`Subprocess exited with code ${code}`);
				err.command = cmd;
				err.args    = args;
				err.opts    = opts;
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

	if (!Object.prototype.hasOwnProperty.call(params, 'command')) {
		throw new SubprocessError(codes.MISSING_ARGUMENT, 'Missing required argument "%s"', 'command');
	}
	if (!params.command || typeof params.command !== 'string') {
		throw new SubprocessError(codes.INVALID_ARGUMENT, 'Spawn "command" must be a non-empty string');
	}

	let args = [];
	if (Object.prototype.hasOwnProperty.call(params, 'args')) {
		if (Array.isArray(params.args)) {
			args = params.args;
		} else if (params.args) {
			args = [ params.args ];
		} else {
			throw new SubprocessError(codes.INVALID_ARGUMENT, 'Spawn "arguments" must be an array');
		}
	}

	// we scrub the supplied options for only allowed options
	const options = {
		windowsHide: true
	};

	if (Object.prototype.hasOwnProperty.call(params, 'options')) {
		if (!params.options || typeof params.options !== 'object') {
			throw new SubprocessError(codes.INVALID_ARGUMENT, 'Spawn "options" must be an object');
		}

		for (const prop of [ 'cwd', 'env', 'stdio', 'windowsHide' ]) {
			if (Object.prototype.hasOwnProperty.call(params.options, prop)) {
				options[prop] = params.options[prop];
			}
		}
	}

	logger.log('Executing: %s %s', highlight(params.command), highlight(prettyArgs(args)));

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
 * @param {Object} [opts] - Options to pass into `which`.
 * @param {String|RegExp} [opts.colon] - The pattern used to split the list of paths.
 * @param {String} [opts.path] - A delimited list of paths. `which` defaults to `process.env.PATH`.
 * @param {String} [opts.pathExt] - A delimited list of executable extensions. Windows only.
 * @returns {Promise} Resolves the specified executable.
 */
export async function which(executables, opts) {
	if (!Array.isArray(executables)) {
		executables = [ executables ];
	}

	return executables
		.reduce(async (promise, executable) => {
			return promise.then(result => {
				return result || new Promise(resolve => {
					return _which(executable, opts || {}, (err, file) => {
						return resolve(err ? undefined : file);
					});
				});
			});
		}, Promise.resolve())
		.then(result => {
			if (result) {
				return result;
			}
			throw new Error('Unable to find executable');
		});
}

/**
 * Formats an array of arguments and quotes arguments containing a space.
 *
 * @param {Array.<String>} args - The array of arguments.
 * @returns {String}
 */
function prettyArgs(args) {
	if (!args) {
		return '';
	}

	return args
		.map(a => {
			return typeof a === 'string' && a.indexOf(' ') !== -1 ? `"${a}"` : a;
		})
		.join(' ');
}
