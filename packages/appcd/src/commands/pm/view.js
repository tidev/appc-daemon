export default {
	aliases: [ '!v', 'info', '!show' ],
	args: [
		{
			name: 'package',
			desc: 'The plugin package name and version',
			required: true
		},
		{
			name: 'filter',
			desc: 'Display specific plugin fields'
		}
	],
	desc: 'Display info for an appcd plugin',
	options: {
		'--json': 'Outputs the results as JSON'
	},
	async action({ argv, cli, console }) {
		const [
			{ plugins: pm },
			{ snooplogg },
			{ get },
			semver,
			{ formatError, loadConfig },
			humanize
		] = await Promise.all([
			import('appcd-core'),
			import('appcd-logger'),
			import('appcd-util'),
			import('semver'),
			import('../../common'),
			import('humanize')
		]);

		const { bold, cyan, gray, green, magenta, yellow } = snooplogg.chalk;
		let manifest;

		try {
			manifest = await pm.view(argv.package);
		} catch (err) {
			console.log(formatError(err, argv.json));
			process.exit(1);
		}

		const home = loadConfig(argv).get('home');
		const plugins = await pm.list({ filter: manifest.name, home });
		const installed = new Set();

		for (const plugin of plugins) {
			installed.add(plugin.version);
		}

		const vers = Object.keys(manifest.versions).sort(semver.rcompare);
		let plugin = !argv.json || argv.filter ? manifest.versions[manifest.version] : manifest;

		if (argv.filter) {
			cli.banner = false;
			plugin = get(plugin, argv.filter.split('.'));
			if (!argv.json) {
				if (plugin !== undefined && plugin !== null) {
					console.log(plugin);
				}
				return;
			}
		}

		if (argv.json) {
			console.log(JSON.stringify(plugin, null, '  '));
			return;
		}

		console.log(`${bold(magenta(`${plugin.name}@${plugin.version}`))}\n`);

		if (plugin.description) {
			console.log(`${plugin.description}\n`);
		}

		for (const issue of Object.values(plugin.issues)) {
			console.log(`${yellow(issue)}\n`);
		}

		console.log(`Homepage:     ${cyan(plugin.homepage || 'n/a')}`);
		console.log(`Author:       ${cyan(plugin.author?.name || plugin.author || 'n/a')}`);
		if (plugin.license) {
			console.log(`License:      ${cyan(plugin.license?.type || plugin.license || 'n/a')}`);
		}
		console.log(`Dependencies: ${cyan(plugin.dependencies ? Object.keys(plugin.dependencies).length : 0)}`);
		if (plugin.appcd.os) {
			console.log(`Platforms:    ${cyan(plugin.appcd.os.join(', '))}`);
		}
		console.log(`API Version:  ${cyan(plugin.appcd.apiVersion)}`);
		console.log(`Core Version: ${cyan(plugin.appcd.appcdVersion || '*')}`);
		console.log(`Plugin Type:  ${cyan(plugin.appcd.type || 'external')}`);
		let i = 0;
		for (const ver of vers) {
			const { supported } = manifest.versions[ver];
			const style = supported ? green : gray;
			console.log(`${(i++ ? '' : 'Versions:').padEnd(14)}${style(ver)}   ${gray(`${humanize.date('Y-m-d', new Date(manifest.time[ver]))}`)}${installed.has(ver) ? magenta('  installed') : ''}`);
		}
		console.log();

		if (!installed.has(plugin.version)) {
			console.log(`To install, run: ${cyan(`appcd pm i ${plugin.name}@${plugin.version}`)}`);
		}
	}
};
