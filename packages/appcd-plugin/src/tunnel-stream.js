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
			if (Array.isArray(message.args)) {
				message.args = message.args.map(scrub);
			}

			process.send({
				type: 'log',
				message
			});
		}
		cb();
	}
}

/**
 * Deeply scrubs an object of values that don't serialize.
 *
 * @param {*} it - The value to check.
 * @returns {*} The original object.
 */
function scrub(it) {
	if (it instanceof Error) {
		return it.stack;
	}

	if (typeof it === 'function') {
		return `[Function: ${it.name || 'anonymous'}]`;
	}

	if (Array.isArray(it)) {
		return it.map(scrub);
	}

	if (it && typeof it === 'object') {
		// need to return a new object as to not clobber the original
		const obj = {};
		for (const key of Object.keys(it)) {
			obj[key] = scrub(it[key]);
		}
		return obj;
	}

	return it;
}
