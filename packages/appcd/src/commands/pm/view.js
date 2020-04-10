export default {
	aliases: [ 'v', 'info', 'show' ],
	args: [
		{
			name: 'package',
			hint: 'package[@version]',
			desc: 'The plugin package name and version',
			required: true
		},
		{
			name: 'filter',
			hint: 'field[.subfield]',
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
			{ default: npa },
			semver,
			{ loadConfig },
		] = await Promise.all([
			import('appcd-core'),
			import('appcd-logger'),
			import('appcd-util'),
			import('npm-package-arg'),
			import('semver'),
			import('../../common')
		]);

		const { bold, cyan, gray, green, magenta, red, yellow } = snooplogg.chalk;
		const { fetchSpec } = npa(argv.package);
		let manifest;

		try {
			manifest = await pm.view(argv.package);
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

		const vers = Object.keys(manifest.versions).sort(semver.rcompare);
		const ver = (fetchSpec && manifest['dist-tags']?.[fetchSpec]) || (fetchSpec && manifest.versions[fetchSpec] && fetchSpec) || manifest['dist-tags']?.latest || vers[0];
		let plugin = !argv.json || argv.filter ? manifest.versions[ver] : manifest;

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
		for (const v of vers) {
			const { supported } = manifest.versions[v];
			const style = supported ? green : v === ver ? yellow : gray;
			console.log(`${(i++ ? '' : 'Versions:').padEnd(14)}${style(v)}${v === ver ? ' <--' : ''}`);
		}
		console.log();

		const cfg = loadConfig(argv);
		const plugins = await pm.list(cfg.get('home'));
		const installed = plugins.find(p => p.name === plugin.name && p.version === plugin.version);
		if (installed) {
			console.log(`${plugin.name}@${plugin.version} is installed ${gray(`(${installed.path})`)}`);
		} else {
			console.log(`To install, run: ${cyan(`appcd pm i ${plugin.name}@${plugin.version}`)}`);
		}
	}
};
