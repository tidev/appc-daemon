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
		if (process.connected && typeof message === 'object') {
			// important! we must clone `message` because redact() will mutate the message
			// object which may be referenced elsewhere

			const formatOpts = { colors: true, depth: null };

			message.args = [
				util.format(...message.args.map(it => {
					if (process.env.APPCD_ENV === 'development') {
						return typeof it === 'string' ? it : util.inspect(it, formatOpts);
					}

					if (typeof it === 'string') {
						return redact(it);
					}

					return util.inspect(redact(it, { clone: true }), formatOpts);
				}))
			];

			process.send({ message, type: 'log' });
		}
		cb();
	}
}
