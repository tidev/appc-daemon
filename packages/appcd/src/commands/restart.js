export default {
	desc: 'Stops the Appc Daemon if running, then starts it',
	options: {
		'--debug': 'Starts the daemon in debug mode',
		'--debug-inspect': 'Starts the daemon in debug mode and connects to the Node.js debugger'
	},
	async action({ argv, console }) {
		const { loadConfig, startServer, stopServer } = await import('../common');

		const cfg = loadConfig(argv);
		const wasRunning = await stopServer({ cfg });

		await startServer({ cfg, argv });
		console.log(wasRunning ? 'Appc Daemon restarted' : 'Appc Daemon started');
	}
};
