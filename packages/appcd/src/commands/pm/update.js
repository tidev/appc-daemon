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
			{ loadConfig },
			{ default: Table },
			semver
		] = await Promise.all([
			import('appcd-core'),
			import('appcd-logger'),
			import('../../common'),
			import('cli-table3'),
			import('semver')
		]);

		const { green } = snooplogg.chalk;
		const results = await pm.checkUpdates({
			home: loadConfig(argv).get('home'),
			plugin: argv.plugin
		});

		results.sort((a, b) => a.name.localeCompare(b.name) || semver.compare(a.available, b.available));

		if (argv.json) {
			console.log(JSON.stringify(results, null, '  '));
			return;
		}

		if (results.length) {
			const table = new Table({
				chars: {
					bottom: '', 'bottom-left': '', 'bottom-mid': '', 'bottom-right': '',
					left: '', 'left-mid': '',
					mid: '', 'mid-mid': '', middle: '  ',
					right: '', 'right-mid': '',
					top: '', 'top-left': '', 'top-mid': '', 'top-right': ''
				},
				head: [ 'Name', 'Installed', '', 'Available' ],
				style: {
					head: [ 'bold' ],
					'padding-left': 0,
					'padding-right': 0
				}
			});

			for (const pkg of results) {
				table.push([ green(pkg.name), pkg.installed || 'n/a', '→', pkg.available ]);
			}

			console.log(table.toString());
		} else {
			console.log('Everything is up-to-date!');
		}
	}
};
