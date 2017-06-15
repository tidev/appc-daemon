import path from 'path';

import { loadConfig, startServer, stopServer } from './common';

const cmd = {
	options: {
		'--debug': { desc: 'don\'t run as a background daemon' }
	},
	action({ argv }) {
		const cfg = loadConfig(argv);

		return stopServer({ cfg })
			.then(() => startServer({ cfg, argv }));
	}
};

export default cmd;
