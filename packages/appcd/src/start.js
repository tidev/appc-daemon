import { loadConfig, startServer } from './common';

const cmd = {
	desc: 'starts the Appc Daemon if it\'s not already running',
	options: {
		'--debug': { desc: 'don\'t run as a background daemon' }
	},
	async action({ argv }) {
		const cfg = loadConfig(argv);

		try {
			await startServer({ cfg, argv });
			console.log('Appc Daemon started');
		} catch (err) {
			const code = err.exitCode || 1;
			console.error(`${err.message} (code ${code})`);
			process.exit(code);
		}
	}
};

export default cmd;
