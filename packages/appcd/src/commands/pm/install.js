export default {
	aliases: [ 'i' ],
	args: [
		{
			name: 'plugins...',
			desc: 'One or more plugins to install',
			required: true
		}
	],
	desc: 'Install appcd plugins',
	options: {
		'--json': 'Outputs the results as JSON'
	},
	async action({ argv, console }) {
		const [
			{ plugins: pm },
			{ snooplogg },
			{ assertNotSudo, formatError, loadConfig }
		] = await Promise.all([
			import('appcd-core'),
			import('appcd-logger'),
			import('../../common')
		]);

		assertNotSudo();

		const { cyan } = snooplogg.chalk;
		const home = loadConfig(argv).get('home');
		const start = new Date();

		await new Promise(resolve => {
			pm.install({ home, plugins: argv.plugins })
				.on('download', manifest => !argv.json && console.log(`Downloading ${cyan(`${manifest.name}@${manifest.version}`)}...`))
				.on('install', () => !argv.json && console.log('Installing dependencies...'))
				.on('error', err => {
					console.log(formatError(err, argv.json));
					process.exit(1);
				})
				.on('finish', installed => {
					if (argv.json) {
						console.log(JSON.stringify(installed, null, 2));
					} else {
						if (!installed.length) {
							console.log(`Plugin${argv.plugins.length !== 1 || argv.plugins.includes('default') ? 's' : ''} already installed`);
						}
						console.log(`\nFinished in ${cyan(((new Date() - start) / 1000).toFixed(1))} seconds`);
					}
					resolve();
				});
		});
	}
};
