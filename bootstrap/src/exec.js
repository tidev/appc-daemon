const cmd = {
	args: [
		{ name: 'path', required: true, regex: /^\//, desc: 'the path to request' },
		{ name: 'json', type: 'json', desc: 'an option JSON payload to send' }
	],
	action: ({ argv }) => {
		//
	}
};

export default cmd;
