import { createRequest, loadConfig } from './common';

const cmd = {
	action: ({ argv, _ }) => {
		// const cfg = loadConfig(argv);
		// const [ path, json ] = _;
		//
		// createRequest(cfg, path, json, argv.subscribe ? 'subscribe' : undefined)
		// 	.request
		// 	.on('response', (message, response) => {
		// 		if (!argv.subscribe) {
		// 			console.log(message);
		// 			process.exit(0);
		// 		}
		//
		// 		if (response.type === 'publish') {
		// 			console.log(message);
		// 		}
		// 	})
		// 	.on('error', err => {
		// 		console.error(err.message);
		// 		process.exit(1);
		// 	});
	}
};

export default cmd;
