export default {
	args: [
		{ name: 'path', required: true, regex: /^\//, desc: 'The path to request' },
		{ name: 'data', type: 'json', desc: 'Optional JSON payload to send' }
	],
	desc: 'Connects to the Appc Daemon and executes the request',
	help: {
		header() {
			return `${this.desc}.

Note that the command will fail if the Appc Daemon is not running.`;
		},
		footer: ({ style }) => `${style.heading('Examples:')}

  Query the daemon status:
    ${style.highlight('appcd exec /appcd/status')}

  Subscribe to filtered data updates:
    ${style.highlight('appcd exec /appcd/status/system/memory --subscribe')}

  Call the JDK service to return all installed JDKs:
    ${style.highlight('appcd exec /jdk/latest/info')}`
	},
	options: {
		'--subscribe': 'Request a subscription'
	},
	async action({ argv, console }) {
		const { createRequest, loadConfig } = await import('../common');

		const cfg = loadConfig(argv);
		const { data, path } = argv;

		createRequest(cfg, path, data, argv.subscribe ? 'subscribe' : undefined)
			.request
			.on('response', (message, response) => {
				console.log(JSON.stringify(response, null, 2));
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
