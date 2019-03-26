export default {
	desc: 'stops the Appc Daemon if running, then starts it',
	options: {
		'--debug': 'don\'t run as a background daemon'
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
