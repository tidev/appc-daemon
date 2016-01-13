import chalk from 'chalk';
import { PassThrough } from 'stream';
import util from 'util';

export default class Logger {
	static maxBuffer = 100;

	static buffer = [];

	static out = new PassThrough;

	static levels = {
		log: 'gray',
		info: 'green',
		warn: 'yellow',
		error: 'red'
	};

	chalk = chalk;

	constructor(label) {
		label = label ? chalk.gray('[' + label + '] ') : '';

		Object.keys(Logger.levels).forEach(level => {
			const rlabel = label + chalk[Logger.levels[level]](level);

			Object.defineProperty(this, level, {
				enumerable: true,
				value: function () {
					// cache the timestamp and label just in case we're outputting multiple lines
					const prefix = chalk.magenta(new Date().toISOString()) + ' ' + rlabel + ': ';

					const lines = util.format.apply(null, arguments).split('\n');

					// remove old log output from the buffer
					if (Logger.buffer.length + lines.length > Logger.maxBuffer) {
						Logger.buffer.splice(0, Logger.maxBuffer - (Logger.buffer.length + lines.length));
					}

					// write each line to the buffer and stream
					lines.forEach(line => {
						Logger.buffer.push(prefix + line);
						Logger.out.write(prefix + line + '\n');
					});
				}
			});
		});

	}

	static pipe(out, flush=true, colors=false) {
		Logger.out.pipe(out);

		if (flush) {
			// flush the buffer to our new stream
			Logger.buffer.forEach(line => {
				out.write(colors ? line : chalk.stripColor(line));
			});
		}
	}

	static unpipe(out) {
		Logger.out.unpipe(out);
	}
}
