import { loadConfig, startServer } from './common';

const cmd = {
	options: {
		'--debug': { desc: 'don\'t run as a background daemon' }
	},
	async action({ argv }) {
		const cfg = loadConfig(argv);

		await startServer({ cfg, argv });
	}
};

export default cmd;
