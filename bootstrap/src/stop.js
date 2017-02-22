import { loadConfig, stopServer } from './common';

const cmd = {
	options: {
		'--force': { desc: 'force the daemon to stop' }
	},
	action: async ({ argv }) => {
		const wasRunning = await stopServer({
			cfg: loadConfig(argv),
			force: argv.force
		});

		if (!wasRunning) {
			console.log('Server not running (code 2)');
			process.exit(2);
		}
	}
};

export default cmd;
