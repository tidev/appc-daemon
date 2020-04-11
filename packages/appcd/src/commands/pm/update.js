export default {
	aliases: [ 'up' ],
	args: [
		{
			name: 'plugin',
			desc: 'The plugin name to update or blank for all'
		}
	],
	desc: 'Check and install plugin updates',
	options: {
		'--json': 'Outputs the results as JSON',
		'-y, --yes': 'Perform the updates without prompting'
	},
	async action({ argv, console }) {
		const [
			{ plugins: pm },
			{ snooplogg },
			{ colorizeVersionDelta, createTable, loadConfig },
			semver
		] = await Promise.all([
			import('appcd-core'),
			import('appcd-logger'),
			import('../../common'),
			import('semver')
		]);

		const { gray, green } = snooplogg.chalk;
		let results = await pm.checkUpdates({
			home: loadConfig(argv).get('home'),
			plugin: argv.plugin
		});

		results.sort((a, b) => {
			return a.name.localeCompare(b.name) || semver.compare(a.available, b.available);
		});

		const packages = results.map(pkg => `${pkg.name}@${pkg.available}`);

		if (argv.json) {
			if (argv.yes) {
				results = await new Promise((resolve, reject) => {
					pm.update(packages)
						.on('error', reject)
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

		if (!argv.yes) {
			console.log('prompting!');
		}

		console.log('Updating!');

		// await new Promise((resolve, reject) => {
		// 	pm.update(packages)
		// 		.on('error', reject)
		// 		.on('finish', resolve);
		// });
	}
};
