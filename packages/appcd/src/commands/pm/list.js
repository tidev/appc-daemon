export default {
	aliases: [ 'ls' ],
	desc: 'lists all installed plugins',
	async action({ argv, console }) {
		const [
			{ appcdPluginAPIVersion, pm },
			{ snooplogg },
			{ loadConfig }
		] = await Promise.all([
			import('appcd-core'),
			import('appcd-logger'),
			import('../../common')
		]);

		const cfg = loadConfig(argv);
		const plugins = await pm.list(cfg);

		console.log(plugins);
	}
};
