export default {
	aliases: [ 's', 'se' ],
	args: [
		{
			name: 'search',
			desc: 'the package name or keywords',
			required: false
		}
	],
	desc: 'search npm for appcd plugins',
	options: {
		'-a, --all': 'show unsupported plugins'
	},
	async action({ argv, console }) {
		const [
			{ pm },
			{ snooplogg },
			{ default: Table }
		] = await Promise.all([
			import('appcd-core'),
			import('appcd-logger'),
			import('cli-table3')
		]);

		const { cyan, gray, green } = snooplogg.chalk;
		const results = await pm.search(argv.search);
		const supported = results.filter(pkg => pkg.supported);
		const plugins = (argv.all ? results : supported).sort((a, b) => a.name.localeCompare(b.name));
		const unsupported = results.length - supported.length;

		if (argv.json) {
			console.log(plugins);
			return;
		}

		if (!plugins.length) {
			console.log('No appcd plugins found');
			return;
		}

		console.log(`Found ${cyan(plugins.length)} plugin${plugins.length !== 1 ? 's' : ''}${unsupported ? gray(` (${unsupported} unsupported)`) : ''}\n`);

		const table = new Table({
			chars: {
				bottom: '', 'bottom-left': '', 'bottom-mid': '', 'bottom-right': '',
				left: '', 'left-mid': '',
				mid: '', 'mid-mid': '', middle: '  ',
				right: '', 'right-mid': '',
				top: '', 'top-left': '', 'top-mid': '', 'top-right': ''
			},
			head: [ 'Name', 'Version', 'Description', 'API Version' ],
			style: {
				head: [ 'bold' ],
				'padding-left': 0,
				'padding-right': 0
			}
		});

		for (const pkg of plugins) {
			if (pkg.appcd.supported) {
				table.push([ green(pkg.name), pkg.version, pkg.description, pkg.appcd.apiVersion || '*' ]);
			} else {
				table.push([ gray(pkg.name), gray(pkg.version), gray(pkg.description), gray(pkg.appcd.apiVersion || '*') ]);
			}
		}

		console.log(`${table.toString()}\n`);
		console.log(`To install a plugin, run ${cyan('appcd pm install <name>')}`);
	}
};
