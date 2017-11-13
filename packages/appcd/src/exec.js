import { createRequest, loadConfig } from './common';
import { inspect } from 'util';

const cmd = {
	args: [
		{ name: 'path', required: true, regex: /^\//, desc: 'the path to request' },
		{ name: 'json', type: 'json', desc: 'an option JSON payload to send' }
	],
	desc: 'connects to the Appc Daemon and executes the request',
	options: {
		'--subscribe': { desc: 'request a subscription' }
	},
	action({ argv, _ }) {
		const cfg = loadConfig(argv);
		const [ path, json ] = _;

		createRequest(cfg, path, json, argv.subscribe ? 'subscribe' : undefined)
			.request
			.on('response', (message, response) => {
				if (!argv.subscribe) {
					console.log(inspect(message, { depth: null }));
					process.exit(0);
				}

				if (response.type === 'event') {
					if (response.fin) {
						process.exit(0);
					}
					console.log(inspect(message, { depth: null }));
				}
			})
			.on('error', err => {
				if (err.code === 'ECONNREFUSED') {
					console.log('Server not running');
					process.exit(3);
				} else {
					console.error(err.message);
					process.exit(err.exitCode || 1);
				}
			});
	}
};

export default cmd;
