export default {
	aliases: [ 'up' ],
	args: [
		{
			name: 'plugins...',
			desc: 'One or more plugins to update or blank for all'
		}
	],
	desc: 'Check and install plugin updates',
	options: {
		'--json': 'Outputs the results as JSON',
		'-y, --yes': 'Perform the updates without prompting'
	},
	async action({ argv, console, terminal }) {
		const [
			{ plugins: pm },
			{ snooplogg },
			{ colorizeVersionDelta, createTable, formatError, loadConfig },
			semver
		] = await Promise.all([
			import('appcd-core'),
			import('appcd-logger'),
			import('../../common'),
			import('semver')
		]);

		const { cyan, gray, green } = snooplogg.chalk;
		const home = loadConfig(argv).get('home');
		let results = (await pm.checkUpdates({ home, plugins: argv.plugins })).sort((a, b) => {
			return a.name.localeCompare(b.name) || semver.compare(a.available, b.available);
		});
		const plugins = results.map(pkg => `${pkg.name}@${pkg.available}`);

		if (argv.json) {
			if (argv.yes) {
				results = await new Promise(resolve => {
					pm.install({ home, plugins })
						.on('error', err => {
							console.log(formatError(err, true));
							process.exit(1);
						})
						.on('finish', resolve);
				});
			}
			console.log(JSON.stringify(results, null, '  '));
			return;
		}

		if (!results.length) {
			console.log('Everything is up-to-date!');
			return;
		}

		const table = createTable('Name', 'Installed', '', 'Available');
		for (const pkg of results) {
			table.push([
				green(pkg.name),
				{ hAlign: 'center', content: pkg.installed || gray('-') },
				'→',
				{ hAlign: 'center', content: colorizeVersionDelta(pkg.installed, pkg.available) }
			]);
		}

		console.log(table.toString());
		console.log();

		if (!argv.yes) {
			await new Promise(resolve => {
				terminal.once('keypress', str => {
					terminal.stdout.write('\n');
					if (str === 'y' || str === 'Y') {
						return resolve();
					}
					process.exit(0);
				});
				terminal.stdout.write('Do you want to update? (y/N) ');
			});
		}

		await new Promise(resolve => {
			const start = new Date();
			pm.install({ home, plugins })
				.on('download', manifest => console.log(`Downloading ${cyan(`${manifest.name}@${manifest.version}`)}...`))
				.on('install', () => console.log('Installing dependencies...'))
				.on('error', err => {
					console.log(formatError(err));
					process.exit(1);
				})
				.on('finish', installed => {
					if (argv.json) {
						console.log(JSON.stringify(installed, null, 2));
					} else {
						console.log(`\nFinished in ${cyan(((new Date() - start) / 1000).toFixed(1))} seconds`);
					}
					resolve();
				});
		});
	}
};
