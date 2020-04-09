export default {
	aliases: [ 'un', 'unlink', 'r', 'rm', 'remove' ],
	args: [
		{
			name: 'plugin',
			hint: 'plugin[@version]',
			desc: 'The plugin name and version to uninstall',
			required: true
		}
	],
	desc: 'Uninstall an appcd plugin',
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
			pm.uninstall(argv.plugin, loadConfig(argv).get('home'))
				.on('uninstall', plugin => console.log(`Removing ${cyan(`${plugin.name}@${plugin.version}`)}...`))
				.on('cleanup', () => console.log('Cleaning dependencies...'))
				.on('error', err => console.error(red(err.toString())))
				.on('finish', resolve);
		});

		console.log(`\nFinished in ${cyan(((new Date() - start) / 1000).toFixed(1))} seconds`);
	}
};
