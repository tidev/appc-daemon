export default {
	desc: 'stops the Appc Daemon if running, then starts it',
	options: {
		'--debug': 'starts the daemon in debug mode',
		'--debug-inspect': 'starts the daemon in debug mode and connects to the Node.js debugger'
	},
	async action({ argv }) {
		const { loadConfig, startServer, stopServer } = await import('../common');

		const cfg = loadConfig(argv);
		const wasRunning = await stopServer({ cfg });

		try {
			await startServer({ cfg, argv });
			console.log(wasRunning ? 'Appc Daemon restarted' : 'Appc Daemon started');
		} catch (err) {
			console.error(err.message);
			process.exit(err.exitCode || 1);
		}
	}
};
