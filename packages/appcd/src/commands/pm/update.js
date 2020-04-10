export default {
	aliases: [ 'up' ],
	args: [
		{
			name: 'plugin',
			desc: 'The plugin name to update or blank for all'
		}
	],
	desc: 'Check and install plugin updates',
	async action({ argv, console }) {
		const [
			{ plugins: pm },
			{ snooplogg },
			{ loadConfig },
			{ default: Table }
		] = await Promise.all([
			import('appcd-core'),
			import('appcd-logger'),
			import('../../common'),
			import('cli-table3')
		]);

		const updates = await pm.checkUpdates({
			home: loadConfig(argv).get('home'),
			plugin: argv.plugin
		});

		console.log(updates);
	}
};
