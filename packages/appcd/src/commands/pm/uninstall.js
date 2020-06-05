export default {
	aliases: [ '!un', '!unlink', '!r', 'rm', '!remove' ],
	args: [
		{
			name: 'plugins...',
			desc: 'One or more plugins to uninstall',
			required: true
		}
	],
	desc: 'Uninstall appcd plugins',
	options: {
		'--json': 'Outputs the results as JSON'
	},
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

		const { cyan } = snooplogg.chalk;
		const home = loadConfig(argv).get('home');
		const start = new Date();

		await new Promise((resolve, reject) => {
			pm.uninstall({ home, plugins: argv.plugins })
				.on('uninstall', plugin => !argv.json && console.log(`Removing ${cyan(`${plugin.name}@${plugin.version}`)}...`))
				.on('cleanup', () => !argv.json && console.log('Cleaning dependencies...'))
				.on('error', reject)
				.on('finish', uninstalled => {
					if (argv.json) {
						console.log(JSON.stringify(uninstalled, null, 2));
					} else {
						console.log(`\nFinished in ${cyan(((new Date() - start) / 1000).toFixed(1))} seconds`);
					}
					resolve();
				});
		});
	}
};
