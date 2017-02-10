import { loadConfig, stopServer } from './common';

const cmd = {
	options: {
		'--force':              { desc: 'force the daemon to stop' }
	},
	action: ({ argv }) => {
		const cfg = loadConfig(argv);

		return stopServer({
			cfg,
			force: argv.force
		});
	}
};

export default cmd;
