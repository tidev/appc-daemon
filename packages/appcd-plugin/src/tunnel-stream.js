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
	 * @param {Object|String} message - The log message.
	 * @param {String} enc - The message encoding. Not used.
	 * @param {Function} cb - The callback after the write is complete.
	 * @access public
	 */
	_write(message, enc, cb) {
		if (process.connected) {
			if (message instanceof Buffer) {
				message = String(message).trim();
			} else if (typeof message === 'object' && Array.isArray(message.args)) {
				message.args = message.args.map(arg => {
					return arg instanceof Error ? (arg.stack || arg.toString()) : arg;
				});
			}

			process.send({
				type: 'log',
				message
			});
		}
		cb();
	}
}
