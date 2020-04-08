export default {
	aliases: [ 'v', 'info', 'show' ],
	args: [
		{
			name: 'plugin',
			hint: 'plugin[@version]',
			desc: 'the package name and version to install',
			required: true
		},
		{
			name: 'filter',
			hint: 'field[.subfield]',
			desc: 'display specific plugin fields'
		}
	],
	desc: 'display info for an appcd plugin',
	async action({ argv, cli, console }) {
		const [
			{ pm },
			{ snooplogg },
			{ get }
		] = await Promise.all([
			import('appcd-core'),
			import('appcd-logger'),
			import('appcd-util')
		]);

		const { bold, cyan, magenta, red, yellow } = snooplogg.chalk;
		let plugin;

		try {
			plugin = await pm.view(argv.plugin);
		} catch (e) {
			if (argv.json) {
				console.log(JSON.stringify({
					error: {
						code: e.code,
						message: e.message
					}
				}, null, '  '));
			} else {
				console.log(red(`Error: ${e.message}`));
			}
			return;
		}

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

		console.log(`${bold(magenta(`${plugin.name} ${plugin.version}`))}\n`);

		if (plugin.description) {
			console.log(`${plugin.description}\n`);
		}

		if (Array.isArray(plugin.issues) && plugin.issues.length) {
			console.log(`${yellow(plugin.issues.join('\n'))}\n`);
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
		console.log(`Run Type:     ${cyan(plugin.appcd.type || 'external')}`);
	}
};
