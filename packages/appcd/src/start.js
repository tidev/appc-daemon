import { banner, loadConfig, startServer } from './common';

const cmd = {
	options: {
		'--debug': { desc: 'don\'t run as a background daemon' }
	},
	async action({ argv }) {
		const cfg = loadConfig(argv);

		console.log(banner());

		try {
			await startServer({ cfg, argv });
			console.log('Appc Daemon started');
		} catch (code) {
			switch (code) {
				case 1:
					console.error('Failed to start the Appc Daemon');
					break;

				case 4:
					console.log('Appc Daemon already started');
					break;

				case 5:
					console.error('Error: Daemon cannot be run as root');
					break;
			}
			process.exit(code);
		}
	}
};

export default cmd;
