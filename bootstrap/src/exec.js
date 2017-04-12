import { createRequest, loadConfig } from './common';

const cmd = {
	options: {
		'--subscribe': { desc: 'request a subscription' }
	},
	args: [
		{ name: 'path', required: true, regex: /^\//, desc: 'the path to request' },
		{ name: 'json', type: 'json', desc: 'an option JSON payload to send' }
	],
	action: ({ argv, _ }) => {
		const cfg = loadConfig(argv);
		const [ path, json ] = _;

		createRequest(cfg, path, json, argv.subscribe ? 'subscribe' : undefined)
			.request
			.on('response', (message, response) => {
				if (!argv.subscribe) {
					console.log(message);
					process.exit(0);
				}

				if (response.type === 'publish') {
					console.log(message);
				}
			});
	}
};

export default cmd;
