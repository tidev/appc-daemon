export default {
	args: [
		{ name: 'filters...', desc: 'One or more namespace patterns' }
	],
	desc: 'Streams Appc Daemon debug log output',
	async action({ argv, terminal }) {
		const [
			{ createInstanceWithDefaults, Format, StdioStream, StripColors },
			{ arrayify },
			{ createRequest, loadConfig }
		] = await Promise.all([
			import('appcd-logger'),
			import('appcd-util'),
			import('../common')
		]);

		const cfg = loadConfig(argv);

		let formatter;
		if (argv.color) {
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

		return new Promise((resolve, reject) => {
			createRequest(cfg, '/appcd/logcat')
				.request
				.on('response', (message, response) => {
					if (logger.isEnabled(response.ns)) {
						terminal.stdout.write(message);
					}
				})
				.once('error', err => {
					if (err.code === 'ECONNREFUSED') {
						err = new Error('Server not running');
						err.exitCode = 3;
					}
					reject(err);
				});
		});
	}
};
