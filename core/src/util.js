import os from 'os';
import { spawn } from 'child_process';

/**
 * Spawns a new node process with the specfied args.
 *
 * @param {Array} [args] - An array of arguments to pass to the subprocess.
 * @param {Object} [opts] - Spawn options.
 * @param {String} [opts.nodePath] - The path to the Node.js executable.
 * @returns {Promise}
 */
export function spawnNode(args = [], opts = {}) {
	const cmd = opts.nodePath || process.env.NODE_EXEC_PATH || process.execPath;
	const v8args = opts.v8args || [];

	// if the user has more than 2GB of RAM, set the max memory to 3GB or 75% of the total memory
	const totalMem = Math.floor(os.totalmem() / 1e6);
	if (totalMem * 0.75 > 1500) {
		v8args.push('--max_old_space_size=' + Math.min(totalMem * 0.75, 3000));
	}
	args.unshift.apply(args, v8args);

	appcd.logger.debug('Executing: ' + appcd.logger.highlight(cmd + ' ' + args.join(' ')));

	return Promise.resolve(spawn(cmd, args, opts));
}
