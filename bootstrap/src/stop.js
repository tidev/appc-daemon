const cmd = {
	options: {
		'--config <json>':      { type: 'json', desc: 'serialized JSON string to mix into the appcd config' },
		'--config-file <file>': { type: 'file', desc: 'path to a appcd JS config file' },
		'--force':              { desc: 'force the daemon to stop' }
	},
	action: ({ argv }) => {
		//
	}
};

export default cmd;
