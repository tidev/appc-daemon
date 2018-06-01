import { loadConfig, startServer, stopServer } from '../common';

const cmd = {
	desc: 'stops the Appc Daemon if running, then starts it',
	options: {
		'--debug': { desc: 'don\'t run as a background daemon' }
	},
	async action({ argv }) {
		const cfg = loadConfig(argv);
		const wasRunning = await stopServer({ cfg });

		try {
			await startServer({ cfg, argv });
			console.log(wasRunning ? 'Appc Daemon restarted' : 'Appc Daemon started');
		} catch (err) {
			console.error(err.message);
			process.exit(err.exitCode || 1);
		}
	}
};

export default cmd;
