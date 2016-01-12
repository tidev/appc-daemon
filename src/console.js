import chalk from 'chalk';
import { PassThrough } from 'stream';
import util from 'util';

export default class Console {
	maxBuffer = 100;

	buffer = [];

	out = new PassThrough;

	levels = {
		log: 'gray',
		info: 'green',
		warn: 'yellow',
		error: 'red'
	};

	constructor(opts = {}) {
		// override the console.* methods
		this.new(null, console);

		Object.defineProperty(console, 'chalk', {
			enumerable: true,
			value: chalk
		});

		Object.defineProperty(console, 'new', {
			enumerable: true,
			value: this.new.bind(this)
		});
	}

	new(label, obj={}) {
		label = label ? chalk.gray('[' + label + '] ') : '';

		Object.keys(this.levels).forEach(level => {
			const rlabel = label + chalk[this.levels[level]](level);

			Object.defineProperty(obj, level, {
				enumerable: true,
				value: function () {
					// cache the timestamp and label just in case we're outputting multiple lines
					const prefix = chalk.magenta(new Date().toISOString()) + ' ' + rlabel + ': ';

					const lines = util.format.apply(null, arguments).split('\n');

					// remove old log output from the buffer
					if (this.buffer.length + lines.length > this.maxBuffer) {
						this.buffer.splice(0, this.maxBuffer - (this.buffer.length + lines.length));
					}

					// write each line to the buffer and stream
					lines.forEach(line => {
						this.buffer.push(prefix + line);
						this.out.write(prefix + line + '\n');
					});
				}.bind(this)
			});
		});

		return obj;
	}

	pipe(out, flush=true, colors=false) {
		this.out.pipe(out);

		if (flush) {
			// flush the buffer to our new stream
			this.buffer.forEach(line => {
				out.write(colors ? line : chalk.stripColor(line));
			});
		}
	}

	unpipe(out) {
		this.out.unpipe(out);
	}
}
