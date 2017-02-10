import { createRequest, loadConfig } from './common';

const cmd = {
	options: {
		'--json': { desc: 'outputs the status as JSON' }
	},
	action: ({ argv }) => {
		const cfg = loadConfig(argv);
		const { client, request } = createRequest(cfg, '/appcd/status');

		request.on('response', data => {
			client.disconnect();
			if (argv.json) {
				console.info(data);
			} else {
				const { appcd, node, system } = JSON.parse(data);
				console.info(`Version:      ${appcd.version}`);
				console.info(`PID:          ${appcd.pid}`);
				console.info(`Uptime:       ${(appcd.uptime / 60).toFixed(2)} minutes`);
				console.info(`Node.js:      ${node.version}`);
				console.info(`Memory RSS:   ${system.memory.usage.rss}`);
				console.info(`Memory Heap:  ${system.memory.usage.heapUsed} / ${system.memory.usage.heapTotal}`);
			}
		});
	}
};

export default cmd;
