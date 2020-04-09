export default {
	aliases: [ 's', 'se' ],
	args: [
		{
			name: 'search',
			desc: 'A package name or keywords',
			required: false
		}
	],
	desc: 'Search npm for appcd plugins',
	options: {
		'--show-deprecated': 'Show deprecated plugins'
	},
	async action({ argv, console }) {
		const [
			{ plugins: pm },
			{ snooplogg },
			{ default: Table },
			semver
		] = await Promise.all([
			import('appcd-core'),
			import('appcd-logger'),
			import('cli-table3'),
			import('semver')
		]);

		const { cyan, gray, green } = snooplogg.chalk;
		const plugins = await pm.search(argv.search);

		if (argv.json) {
			console.log(plugins);
			return;
		}

		if (!plugins.length) {
			console.log('No appcd plugins found');
			return;
		}

		let unsupported = 0;
		const latestVersions = [];

		for (const pkg of plugins.sort((a, b) => a.name.localeCompare(b.name))) {
			const latest = pkg['dist-tags'].latest || Object.keys(pkg.versions).sort(semver.rcompare)[0];
			if (!pkg.versions[latest]?.deprecated || argv.showDeprecated) {
				// need to identify the latest for each major
				pkg.majors = {};
				for (const ver of Object.keys(pkg.versions)) {
					const major = semver.major(ver);
					if (pkg.majors[major] === undefined || semver.gt(ver, pkg.majors[major])) {
						pkg.majors[major] = ver;
					}
				}

				for (const ver of Object.values(pkg.majors).sort(semver.rcompare)) {
					latestVersions.push(pkg.versions[ver]);
					if (!pkg.supported) {
						unsupported++;
					}
				}
			}
		}

		console.log(`Found ${cyan(latestVersions.length)} plugin${latestVersions.length !== 1 ? 's' : ''}${unsupported ? gray(` (${unsupported} unsupported)`) : ''}\n`);

		const table = new Table({
			chars: {
				bottom: '', 'bottom-left': '', 'bottom-mid': '', 'bottom-right': '',
				left: '', 'left-mid': '',
				mid: '', 'mid-mid': '', middle: '  ',
				right: '', 'right-mid': '',
				top: '', 'top-left': '', 'top-mid': '', 'top-right': ''
			},
			head: [ 'Name', 'Version', 'Description' ],
			style: {
				head: [ 'bold' ],
				'padding-left': 0,
				'padding-right': 0
			}
		});

		for (const pkg of latestVersions) {
			if (pkg.supported) {
				table.push([ green(pkg.name), pkg.version, pkg.description || 'n/a' ]);
			} else {
				table.push([ gray(pkg.name), gray(pkg.version), gray(pkg.description || 'n/a') ]);
			}
		}

		console.log(`${table.toString()}\n`);
		console.log(`To install a plugin, run ${cyan('appcd pm install <name>')}`);
	}
};
