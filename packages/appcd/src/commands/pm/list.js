export default {
	aliases: [ 'ls' ],
	args: [
		{
			name: 'filter',
			desc: 'Filter plugins'
		}
	],
	desc: 'Lists all appcd plugins',
	options: {
		'-d, --detailed': 'Display detailed plugin information',
		'--json': 'Outputs the results as JSON'
	},
	async action({ _argv, argv, console }) {
		const [
			{ plugins: pm },
			{ snooplogg },
			{ createTable, loadConfig }
		] = await Promise.all([
			import('appcd-core'),
			import('appcd-logger'),
			import('../../common')
		]);

		const { cyan, gray, green, magenta, yellow } = snooplogg.chalk;
		const plugins = await pm.list({
			filter: argv.filter,
			home: loadConfig(argv).get('home')
		});

		if (argv.json) {
			console.log(JSON.stringify(plugins, null, '  '));
			return;
		}

		if (!plugins.length) {
			console.log('No plugins found\n');
			console.log(`To install the default plugins, run ${cyan('appcd pm install default')}`);
			return;
		}

		const unsupported = plugins.reduce((count, plugin) => (plugin.supported ? count : count + 1), 0);
		const warn = process.platform === 'win32' ? '!!' : '⚠';

		console.log(`Found ${cyan(plugins.length)} plugin${plugins.length !== 1 ? 's' : ''}${unsupported ? gray(` (${unsupported} unsupported)`) : ''}\n`);

		if (argv.detailed) {
			let i = 0;
			for (const plugin of plugins) {
				const flags = [];
				if (plugin.autoStart) {
					flags.push('Auto-start');
				}
				if (plugin.link) {
					flags.push('Yarn link');
				}

				if (i++) {
					console.log();
				}
				console.log(green(`${plugin.name} ${plugin.version}`));
				if (!plugin.supported) {
					console.log(`  ${yellow(`${warn} Unsupported: ${plugin.error}`)}`);
				}
				if (plugin.description) {
					console.log(`  Description:   ${cyan(plugin.description)}`);
				}
				if (plugin.apiVersion) {
					console.log(`  API Version:   ${cyan(plugin.apiVersion)}`);
				}
				if (plugin.appcdVersion) {
					console.log(`  Appcd Version: ${cyan(plugin.appcdVersion)}`);
				}
				console.log(`  Endpoint:      ${cyan(plugin.endpoint)}`);
				if (plugin.homepage) {
					console.log(`  Homepage:      ${cyan(plugin.homepage)}`);
				}
				if (plugin.license) {
					console.log(`  License:       ${cyan(plugin.license)}`);
				}
				console.log(`  Path:          ${cyan(plugin.path)}`);
				console.log(`  Platforms:     ${cyan(plugin.os?.join(', ') || 'all')}`);
				if (plugin.type) {
					console.log(`  Type:          ${cyan(plugin.type)}`);
				}
				console.log(`  Flags:         ${flags.length ? cyan(flags.join(', ')) : ''}`);
			}
		} else {
			const table = createTable([ 'Name', 'Flags', 'Version', 'Description', 'Endpoint' ]);
			for (const plugin of plugins) {
				const flags = `${plugin.autoStart ? 'A' : ''}${plugin.link ? 'Y' : ''}`;
				if (plugin.supported) {
					table.push([ green(plugin.name), magenta(flags), plugin.version, plugin.description, plugin.endpoint ]);
				} else {
					table.push([ gray(plugin.name), gray(flags), gray(plugin.version), gray(plugin.description), gray(plugin.endpoint) ]);
				}
			}

			console.log(`${table.toString()}

 ${magenta(' A = Auto-start, Y = Yarn link')}

For more info, run ${cyan(`appcd ${_argv.join(' ')} --detailed`)}`);
		}
	}
};
