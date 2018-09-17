export default {
	desc: 'stops the Appc Daemon if running',
	options: {
		'--force': { desc: 'force the daemon to stop' }
	},
	async action({ argv }) {
		const { loadConfig, stopServer } = await import('../common');

		const wasRunning = await stopServer({
			cfg: loadConfig(argv),
			force: argv.force
		});

		if (wasRunning) {
			console.log('Appc Daemon stopped');
		} else {
			console.log('Appc Daemon already stopped');
			process.exit(3);
		}
	}
};
