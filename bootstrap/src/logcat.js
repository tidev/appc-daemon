import { createRequest, loadConfig } from './common';

const cmd = {
	options: {
		'--no-colors': { desc: 'disables colors' }
	},
	action: ({ argv }) => {
		const cfg = loadConfig(argv);

		createRequest(cfg, '/appcd/logcat', { colors: argv.colors })
			.request
			.on('response', process.stdout.write);
	}
};

export default cmd;
