export default {
	aliases: [ 'i' ],
	args: [
		{
			name: 'plugin',
			hint: 'plugin[@version]',
			desc: 'the plugin name and version to install',
			required: true
		}
	],
	desc: 'install an appcd plugin',
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
			pm.install(argv.plugin, loadConfig(argv).get('home'))
				// .on('pre-install', manifests => {})
				.on('download', manifest => console.log(`Downloading ${cyan(`${manifest.name}@${manifest.version}`)}...`))
				.on('install', () => console.log('Installing dependencies...'))
				.on('error', err => console.error(red(err.toString())))
				.on('finish', resolve);
		});

		console.log(`\nFinished in ${cyan(((new Date() - start) / 1000).toFixed(1))} seconds`);
	}
};
