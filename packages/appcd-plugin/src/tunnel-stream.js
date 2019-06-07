import util from 'util';

import { Writable } from 'stream';

/**
 * A stream that sends log messages to the parent process.
 */
export default class TunnelStream extends Writable {
	/**
	 * Creates an object mode stream.
	 */
	constructor() {
		super({
			objectMode: true
		});
	}

	/**
	 * Sends a log message to the associated process.
	 *
	 * @param {Object} message - The log message.
	 * @param {String} enc - The message encoding. Not used.
	 * @param {Function} cb - The callback after the write is complete.
	 * @access public
	 */
	_write(message, enc, cb) {
		if (process.connected && typeof message === 'object') {
			message.args = [
				util.format(...message.args.map(a => {
					return typeof a === 'string' ? a : util.inspect(a, { colors: true, depth: null });
				}))
			];

			process.send({
				type: 'log',
				message
			});
		}
		cb();
	}
}
