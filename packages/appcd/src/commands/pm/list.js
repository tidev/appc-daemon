export default {
	aliases: [ 'ls' ],
	args: [
		{
			name: 'filter',
			hint: 'field[.subfield]',
			desc: 'Filter installed plugins'
		}
	],
	desc: 'Lists all installed plugins',
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

		const unsupported = plugins.reduce((count, plugin) => (plugin.supported ? count + 1 : count), 0);
		const links = plugins.reduce((count, plugin) => (plugin.link ? count + 1 : count), 0);
		const star = process.platform === 'win32' ? '*' : '★';

		console.log(`Found ${cyan(plugins.length)} plugin${plugins.length !== 1 ? 's' : ''}${unsupported ? gray(` (${unsupported} unsupported)`) : ''}\n`);

		if (argv.detailed) {
			let i = 0;
			for (const plugin of plugins) {
				if (i++) {
					console.log();
				}
				console.log(green(`${plugin.name} ${plugin.version}`) + (plugin.link ? magenta(`  (${star} yarn link)`) : ''));
				if (!plugin.supported) {
					console.log(`  ${yellow(`Unsupported: ${plugin.error}`)}\n`);
				}
				if (plugin.description) {
					console.log(`  ${plugin.description}`);
				}
				console.log();
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
			}
		} else {
			const table = createTable('Name', 'Version', 'Description', 'Endpoint');
			for (const plugin of plugins) {
				const x = !links ? '' : plugin.link ? `${magenta(star)} ` : '  ';
				if (plugin.supported) {
					table.push([ `${x}${green(plugin.name)}`, plugin.version, plugin.description, plugin.endpoint ]);
				} else {
					table.push([ `${x}${gray(plugin.name)}`, gray(plugin.version), gray(plugin.description), gray(plugin.endpoint) ]);
				}
			}

			console.log(table.toString());
			if (links) {
				console.log(magenta('└─ yarn link'));
			}
			console.log(`\nFor more info, run ${cyan(`appcd ${_argv.join(' ')} --detailed`)}`);
		}
	}
};
