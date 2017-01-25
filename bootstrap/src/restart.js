const cmd = {
	options: {
		'--config <json>':      { type: 'json', desc: 'serialized JSON string to mix into the appcd config' },
		'--config-file <file>': { type: 'file', desc: 'path to a appcd JS config file' },
		'--debug':              { desc: 'don\'t run as a background daemon' }
	},
	action: ({ argv }) => {
		//
	}
};

export default cmd;
