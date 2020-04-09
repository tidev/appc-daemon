export default {
	aliases: [ 'un', 'unlink', 'r', 'rm', 'remove' ],
	args: [
		{
			name: 'plugin',
			hint: 'plugin[@version]',
			desc: 'the plugin name and version to uninstall',
			required: true
		}
	],
	desc: 'uninstall an appcd plugin',
	async action({ argv, console }) {
		const [
			{ plugins: pm },
			{ snooplogg },
			{ loadConfig }
		] = await Promise.all([
			import('appcd-core'),
			import('appcd-logger'),
			import('../../common')
		]);

		if (process.getuid && process.SUDO_UID) {
			const sudoUID = parseInt(process.SUDO_UID);
			const uid = process.getuid();
			if (sudoUID !== uid) {
				console.error(`Command is being run for a different user (${uid}) than expected (${sudoUID}).`);
				console.error('Running this command as a different user will lead to file permission issues.');
				console.error('Please re-run this command without "sudo".');
				process.exit(9);
			}
		}

		const { cyan, red } = snooplogg.chalk;
		const start = new Date();

		await new Promise(resolve => {
			pm.uninstall(argv.plugin, loadConfig(argv).get('home'))
				.on('uninstall', plugin => console.log(`Removing ${cyan(`${plugin.name}@${plugin.version}`)}...`))
				.on('cleanup', () => console.log('Cleaning dependencies...'))
				.on('error', err => console.error(red(err.toString())))
				.on('finish', resolve);
		});

		console.log(`\nFinished in ${cyan(((new Date() - start) / 1000).toFixed(1))} seconds`);
	}
};
