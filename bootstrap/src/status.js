import { createRequest, loadConfig } from './common';

const cmd = {
	options: {
		'--json': { desc: 'outputs the status as JSON' }
	},
	action: ({ argv }) => {
		const cfg = loadConfig(argv);
		const { client, request } = createRequest(cfg, '/appcd/status');

		request
			.once('error', err => {
				if (err.code !== 'ECONNREFUSED') {
					console.error(err.toString());
					process.exit(1);
				}

				if (argv.json) {
					console.log('{}');
				} else {
					console.log('Server not running (code 2)');
				}
				process.exit(2);
			})
			.on('response', status => {
				client.disconnect();
				if (argv.json) {
					console.info(status);
				} else {
					console.info(`Version:      ${status.version}`);
					console.info(`PID:          ${status.pid}`);
					console.info(`Uptime:       ${(status.uptime / 60).toFixed(2)} minutes`);
					console.info(`Node.js:      ${status.node.version}`);
					console.info(`Memory RSS:   ${status.memory.rss}`);
					console.info(`Memory Heap:  ${status.memory.heapUsed} / ${status.memory.heapTotal}`);
				}
			});
	}
};

export default cmd;
