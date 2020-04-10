export default {
	aliases: [ 'i' ],
	args: [
		{
			name: 'plugin',
			hint: 'plugin[@version]',
			desc: 'The plugin name and version to install',
			required: true
		}
	],
	desc: 'Install an appcd plugin',
	async action({ argv, console }) {
		const [
			{ plugins: pm },
			{ snooplogg },
			{ assertNotSudo, loadConfig }
		] = await Promise.all([
			import('appcd-core'),
			import('appcd-logger'),
			import('../../common')
		]);

		assertNotSudo();

		const { cyan, red } = snooplogg.chalk;
		const start = new Date();

		await new Promise(resolve => {
			pm.install({ home: loadConfig(argv).get('home'), plugin: argv.plugin })
				// .on('pre-install', manifests => {})
				.on('download', manifest => console.log(`Downloading ${cyan(`${manifest.name}@${manifest.version}`)}...`))
				.on('install', () => console.log('Installing dependencies...'))
				.on('error', err => console.error(red(err.toString())))
				.on('finish', resolve);
		});

		console.log(`\nFinished in ${cyan(((new Date() - start) / 1000).toFixed(1))} seconds`);
	}
};
