export default {
	args: [
		{ name: 'path', required: true, regex: /^\//, desc: 'the path to request' },
		{ name: 'json', type: 'json', desc: 'an option JSON payload to send' }
	],
	desc: 'connects to the Appc Daemon and executes the request',
	options: {
		'--subscribe': { desc: 'request a subscription' }
	},
	async action({ argv }) {
		const { createRequest, loadConfig } = await import('../common');

		const cfg = loadConfig(argv);
		const { path, json } = argv;

		createRequest(cfg, path, json, argv.subscribe ? 'subscribe' : undefined)
			.request
			.on('response', (message, response) => {
				if (!argv.subscribe) {
					console.log(JSON.stringify(response, null, 2));
					process.exit(0);
				}

				if (response.type === 'event') {
					if (response.fin) {
						process.exit(0);
					}
					console.log(JSON.stringify(response, null, 2));
				}
			})
			.on('error', err => {
				if (err.code === 'ECONNREFUSED') {
					console.log('Server not running');
					process.exit(3);
				} else {
					console.log(JSON.stringify(err, null, 2));
					process.exit(err.exitCode || 1);
				}
			});
	}
};
