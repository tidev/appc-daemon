import { createRequest, loadConfig } from './common';

const cmd = {
	args: [
		{ name: 'path', required: true, regex: /^\//, desc: 'the path to request' },
		{ name: 'json', type: 'json', desc: 'an option JSON payload to send' }
	],
	action: ({ argv, _ }) => {
		const cfg = loadConfig(argv);
		const [ path, json ] = _;

		createRequest(cfg, path, json)
			.request
			.on('response', response => {
				console.log(response);
				process.exit(0);
			});
	}
};

export default cmd;
