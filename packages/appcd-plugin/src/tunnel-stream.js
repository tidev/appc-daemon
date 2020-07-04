import util from 'util';
import { redact } from 'appcd-util';
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
	 * @param {Object} message - The data payload containing the log message.
	 * @param {String} enc - The message encoding. Not used.
	 * @param {Function} cb - The callback after the write is complete.
	 * @access public
	 */
	_write(message, enc, cb) {
		if (process.connected && typeof data === 'object') {
			process.send({
				type: 'log',
				// important! we must clone `message` because redact() will mutate the message
				// object which may be referenced elsewhere
				message: {
					...message,
					args: [
						util.format(...message.args.map(a => {
							return typeof a === 'string' ? a : util.inspect(redact(a), { colors: true, depth: null });
						}))
					]
				}
			});
		}
		cb();
	}
}
