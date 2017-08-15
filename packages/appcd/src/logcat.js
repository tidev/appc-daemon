import { createRequest, loadConfig } from './common';

const cmd = {
	options: {
		'--no-colors': { desc: 'disables colors' }
	},
	action({ argv }) {
		const cfg = loadConfig(argv);

		createRequest(cfg, '/appcd/logcat', { colors: argv.colors })
			.request
			.on('response', response => process.stdout.write(response))
			.once('error', err => {
				if (err.code === 'ECONNREFUSED') {
					console.log('Server not running');
					process.exit(3);
				} else {
					console.error(err);
					process.exit(1);
				}
			});
	}
};

export default cmd;
