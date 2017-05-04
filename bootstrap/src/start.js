import path from 'path';

import { loadConfig, startServer } from './common';

const cmd = {
	options: {
		'--debug': { desc: 'don\'t run as a background daemon' }
	},
	action: ({ argv }) => {
		const cfg = loadConfig(argv);

		return startServer({ cfg, argv });
	}
};

export default cmd;
