import {
	createInstanceWithDefaults,
	Format,
	StdioStream,
	StripColors
} from 'appcd-logger';

import { createRequest, loadConfig } from './common';

const cmd = {
	args: [
		{ name: 'filter...', desc: 'a filter to apply to the log namespace' }
	],
	desc: 'streams Appc Daemon debug log output',
	options: {
		'--no-colors': { desc: 'disables colors' }
	},
	action({ argv, _ }) {
		const cfg = loadConfig(argv);

		let formatter;
		if (argv.colors) {
			formatter = new Format();
		} else {
			formatter = new StripColors();
		}
		formatter.pipe(new StdioStream());

		let filter = '*';
		if (_.length) {
			if (_.every(a => a[0] === '-')) {
				// if every filter arg is a negation, then that means there are no allowed
				// namespace and want we really want is everything except said filters
				filter = `* ${_.join(' ')}`;
			} else {
				// we have both allowed and ignore namespaces
				filter = _.join(' ');
			}
		}

		const logger = createInstanceWithDefaults()
			.config({
				minBrightness: 80,
				maxBrightness: 200,
				theme: 'detailed'
			})
			.enable(filter)
			.pipe(formatter);

		createRequest(cfg, '/appcd/logcat')
			.request
			.on('response', (message, response) => {
				if (logger.isEnabled(response.ns)) {
					process.stdout.write(message);
				}
			})
			.once('error', err => {
				if (err.code === 'ECONNREFUSED') {
					console.log('Server not running');
					process.exit(3);
				} else {
					console.error(err);
					process.exit(1);
				}
			});
	}
};

export default cmd;
