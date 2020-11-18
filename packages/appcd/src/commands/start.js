export default {
	desc: 'Starts the Appc Daemon if it\'s not already running',
	options: {
		'--debug': 'Starts the daemon in debug mode',
		'--debug-inspect': 'Starts the daemon in debug mode and connects to the Node.js debugger'
	},
	async action({ argv, console }) {
		const { loadConfig, startServer } = await import('../common');
		const cfg = loadConfig(argv);

		await startServer({ cfg, argv });
		console.log('Appc Daemon started');
	}
};
