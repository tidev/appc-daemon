import {
	createInstanceWithDefaults,
	Format,
	StdioStream,
	StripColors
} from 'appcd-logger';

import { arrayify } from 'appcd-util';

import { createRequest, loadConfig } from '../common';

const cmd = {
	args: [
		{ name: 'filters...', desc: 'one or more namespace patterns' }
	],
	desc: 'streams Appc Daemon debug log output',
	options: {
		'--no-colors': { desc: 'disables colors' }
	},
	action({ argv }) {
		return new Promise((resolve, reject) => {
			const cfg = loadConfig(argv);

			let formatter;
			if (argv.colors) {
				formatter = new Format();
			} else {
				formatter = new StripColors();
			}
			formatter.pipe(new StdioStream());

			let filter = '*';
			const filters = arrayify(argv.filters);
			if (filters.length) {
				if (filters.every(a => a[0] === '-')) {
					// if every filter arg is a negation, then that means there are no allowed
					// namespace and want we really want is everything except said filters
					filter = `* ${filters.join(' ')}`;
				} else {
					// we have both allowed and ignore namespaces
					filter = filters.join(' ');
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
						err = new Error('Server not running');
						err.exitCode = 3;
						this.showHelpOnError = false;
					}
					reject(err);
				});
		});
	}
};

export default cmd;
