import { banner, loadConfig, startServer, stopServer } from './common';

const cmd = {
	options: {
		'--debug': { desc: 'don\'t run as a background daemon' }
	},
	async action({ argv }) {
		const cfg = loadConfig(argv);

		console.log(banner());

		const wasRunning = await stopServer({ cfg, force: true });

		try {
			await startServer({ cfg, argv });
			console.log(wasRunning ? 'Appc Daemon restarted' : 'Appc Daemon started');
		} catch (code) {
			switch (code) {
				case 1:
					console.error('Failed to restart the Appc Daemon');
					break;

				case 5:
					console.error('Error: Daemon cannot be run as root');
					break;
			}
		}
	}
};

export default cmd;
