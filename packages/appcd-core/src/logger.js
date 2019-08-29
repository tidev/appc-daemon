import {
	createInstanceWithDefaults,
	StdioStream,
	StripColors
} from 'appcd-logger';
import { format } from 'util';
import { Transform } from 'stream';

const instance = createInstanceWithDefaults()
	.snoop()
	.config({
		maxBufferSize: 1000,
		minBrightness: 80,
		maxBrightness: 200,
		theme: 'detailed'
	})
	.enable('*');

if (!process.env.APPCD_TEST) {
	if (~~process.env.APPCD_NO_COLORS) {
		// need to strip colors
		const formatter = new StripColors();
		formatter.pipe(new StdioStream());
		instance.pipe(formatter, { flush: true });
	} else {
		instance.pipe(new StdioStream(), { flush: true });
	}
}

export default instance;

/**
 * Converts a snooplogg message to a rendered message string along with simplified message metadata.
 */
export class LogcatFormatter extends Transform {
	/**
	 * Initializes the stream and forces object mode.
	 *
	 * @access public
	 */
	constructor() {
		super({
			objectMode: true
		});
	}

	/**
	 * Renders the snooplogg message into a new object with some log message metadata.
	 *
	 * @param {Object|*} msg - The snooplogg message.
	 * @param {String} enc - The message encoding. This is ignored.
	 * @param {Function} cb - A function to call when done.
	 * @access private
	 */
	_transform(msg, enc, cb) {
		let message = '';

		if (!msg || typeof msg !== 'object' || msg instanceof Buffer) {
			message = String(msg);
		} else if (typeof msg.formatter === 'function') {
			message = msg.formatter(msg);
		} else {
			message = format.apply(null, msg.args) + '\n';
		}

		this.push({
			message,
			ns: msg.ns,
			ts: msg.ts,
			type: msg.type
		});

		cb();
	}
}
