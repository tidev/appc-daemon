import { loadConfig, startServer, stopServer } from './common';

const cmd = {
	options: {
		'--config <json>':      { type: 'json', desc: 'serialized JSON string to mix into the appcd config' },
		'--config-file <file>': { type: 'file', desc: 'path to a appcd JS config file' },
		'--debug':              { desc: 'don\'t run as a background daemon' }
	},
	action: ({ argv }) => {
		const { config, configFile, debug } = argv;
		const cfg = loadConfig({ config, configFile });

		return stopServer({ cfg })
			.then(() => startServer({ cfg, debug }));
	}
};

export default cmd;
