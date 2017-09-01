import { loadConfig, stopServer } from './common';

const cmd = {
	options: {
		'--force': { desc: 'force the daemon to stop' }
	},
	async action({ argv }) {
		const wasRunning = await stopServer({
			cfg: loadConfig(argv),
			force: argv.force
		});

		if (!wasRunning) {
			console.log('Appc Daemon already stopped');
			process.exit(3);
		}
	}
};

export default cmd;
