import { loadConfig, stopServer } from './common';

const cmd = {
	options: {
		'--config <json>':      { type: 'json', desc: 'serialized JSON string to mix into the appcd config' },
		'--config-file <file>': { type: 'file', desc: 'path to a appcd JS config file' },
		'--force':              { desc: 'force the daemon to stop' }
	},
	action: ({ argv }) => {
		const { config, configFile, force } = argv;

		return stopServer({
			cfg: loadConfig({ config, configFile }),
			force
		});
	}
};

export default cmd;
