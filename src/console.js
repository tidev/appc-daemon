import chalk from 'chalk';
import util from 'util';

export default class Console {
	constructor(opts = {}) {
		this.chalk = chalk;
		this.maxBuffer = 100;
		this.buffer = [];
		this.streams = [];

		// override the console.* methods
		[['log', 'gray'],
		 ['info', 'green'],
		 ['warn', 'yellow', 'stderr'],
		 ['error', 'red', 'stderr']
	 	].forEach(args => {
			Object.defineProperty(console, args[0], {
				enumerable: true,
				value: this.new.apply(this, args)
			});
		}, this);

		Object.defineProperty(console, 'chalk', {
			enumerable: true,
			value: chalk
		});
	}

	new(label, color, outputType = 'stdout') {
		// cache the prerendered label
		if (color && typeof chalk[color] === 'function') {
			label = chalk[color](label);
		}

		return function () {
			// cache the timestamp and label just in case we're outputting multiple lines
			const prefix = chalk.magenta(new Date().toISOString()) + ' ' + label + ': ';

			// prepend the prefix to each line
			const output = util.format.apply(null, arguments).split('\n').map(line => {
				return prefix + line;
			}) + '\n';

			// remove old log output from the buffer
			while (this.buffer.length >= this.maxBuffer) {
				this.buffer.shift();
			}

			// add the new log output to the buffer
			this.buffer.push({ label, output, outputType });

			// write the new log output to all streams
			this.streams.forEach(stream => {
				stream[outputType].write(stream.colors ? output : chalk.stripColor(output));
			});
		}.bind(this);
	}

	stream(stdout, stderr, colors=true) {
		this.streams.push({ stdout, stderr, colors });

		// flush the buffer to our new stream
		this.buffer.forEach(data => {
			const out = data.outputType === 'stderr' ? stderr : stdout;
			out.write(colors ? data.output : chalk.stripColor(data.output));
		});

		return this;
	}
}
