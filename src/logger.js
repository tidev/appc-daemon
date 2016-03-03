import 'babel-polyfill';
import colors from 'colors/safe';
import { PassThrough, Writable } from 'stream';
import through2 from 'through2';
import util from 'util';

// force the colors to be enabled if the terminal doesn't support them.
colors.enabled = true;

/**
 * A logger object formats and pipes output to a stream.
 */
export default class Logger {
	/**
	 * The main read/write passthrough stream.
	 * @type {stream.PassThrough}
	 */
	static out = new PassThrough({ highWaterMark: 0 });

	/**
	 * The maximum number of lines to buffer.
	 * @type {Number}
	 */
	static maxBuffer = 100;

	/**
	 * Buffer containing the lines of output.
	 * @type {Array}
	 */
	static buffer = [];

	/**
	 * Log levels and their associated colors.
	 * @type {Object}
	 */
	static levels = {
		log: 'gray',
		debug: 'magenta',
		info: 'green',
		warn: 'yellow',
		error: 'red'
	};

	/**
	 * Various styles to help keep output consistent.
	 * @type {Object}
	 */
	static styles = {
		highlight: 'cyan',
		lowlight:  'blue',
		ok:        'green',
		notice:    'yellow',
		alert:     'red',
		note:      'gray'
	};

	/**
	 * List of all registered streams.
	 * @type {Object}
	 */
	static streams = {};

	/**
	 * The colors module.
	 * @type {colors}
	 */
	colors = colors;

	/**
	 * Creates the logger and initializes the log level methods.
	 *
	 * @param {String} [label] - A label to print between the timestamp and the log level.
	 */
	constructor(label) {
		label = label ? colors.gray(('[' + label + '] ').padRight(9)) : '';

		// wire up the log methods
		Object.entries(Logger.levels).forEach(([level, color]) => {
			let rlabel = label + (colors[color](level) + ': ');
			const n = 5 - level.length;
			if (n > 0) {
				rlabel += ''.padRight(n);
			}

			Object.defineProperty(this, level, {
				enumerable: true,
				value: function () {
					// cache the timestamp and label just in case we're outputting multiple lines
					const prefix = colors.magenta(new Date().toISOString()) + ' ' + rlabel;
					const lines = util.format.apply(null, arguments).split('\n');

					// remove old log output from the buffer and stream
					const n = Logger.buffer.length + lines.length;
					if (n > Logger.maxBuffer) {
						Logger.buffer.splice(0, n - Logger.maxBuffer);
					}

					// write each line to the stream
					lines.forEach(line => {
						const str = prefix + line + '\n';
						Logger.buffer.push(str);
						Logger.out.write(str);
					});
				}
			});
		});

		// wire up the style helpers
		Object.entries(Logger.styles).forEach(([name, color]) => {
			Object.defineProperty(this, name, {
				enumerable: true,
				value: str => colors[color](str)
			});
		});
	}

	/**
	 * Pipes the logger to the specified writable stream.
	 *
	 * @param {Writable} out - The stream to pipe the log output to.
	 * @param {Object} [obj] - An object containing various options.
	 * @param {Boolean} [obj.flush=true] - When true, flushes the existing
	 * buffer to the stream immediately.
	 * @param {Boolean} [obj.colors=false] - When true, allows log output to
	 * contain ANSI color codes, otherwise they colors are stripped.
	 * @access public
	 */
	static pipe(out, { flush=true, colors } = {}) {
		let stream = out;
		if (colors) {
			Logger.out.pipe(stream);
			Logger.streams[out] = [ out ];
		} else {
			// strip the colors
			const strip = /\x1B\[\d+m/g;
			stream = through2((chunk, enc, callback) => {
				callback(null, chunk.toString().replace(strip, ''));
			});
			Logger.out.pipe(stream).pipe(out);
			Logger.streams[out] = [ out, stream ];
		}

		if (flush) {
			// flush the buffer to our new stream
			Logger.buffer.forEach(line => stream.write(line));
		}

		out.on('finish', () => Logger.unpipe(out));
		out.on('error', () => Logger.unpipe(out));
	}

	/**
	 * Removes the writeable stream from being piped.
	 *
	 * @param {Writable} out - A stream to no longer pipe logs to.
	 * @access public
	 */
	static unpipe(out) {
		const streams = Logger.streams[out];
		if (streams) {
			streams.forEach(stream => Logger.out.unpipe(stream));
			delete Logger.streams[out];
		}
	}
}

/**
 * A writable stream that swallows up data.
 */
class Blackhole extends Writable {
	_write(chunk, enc, cb) {
		setImmediate(cb);
	}
}

/**
 * The logger's PassThrough stream likes to buffer data, so we need to prime the
 * pipeline with a writable stream to purge the initial PassThrough stream's
 * buffer.
 */
Logger.out.pipe(new Blackhole);
