export default {
	aliases: [ 'ln' ],
	desc: 'Register Yarn linked appcd plugins',
	help: `The Appc Daemon uses the Yarn package manager to manage plugin packages. Yarn has a \
"links" feature where you can link a package somewhere on your machine so that it can be \
referenced from another project.

This command will scan all Yarn linked packages for appcd plugins and register them in the appcd \
home plugins directory. This helpful for plugin development.`,
	options: {
		'--json': 'Outputs the results as JSON'
	},
	async action({ argv, console }) {
		const [
			{ plugins: pm },
			{ snooplogg },
			{ assertNotSudo, loadConfig }
		] = await Promise.all([
			import('appcd-core'),
			import('appcd-logger'),
			import('../../common')
		]);

		assertNotSudo();

		const { cyan } = snooplogg.chalk;
		const plugins = await pm.link(loadConfig(argv).get('home'));

		if (argv.json) {
			console.log(JSON.stringify(plugins, null, '  '));
			return;
		}

		if (plugins.length) {
			for (const plugin of plugins) {
				console.log(`Linked ${cyan(`${plugin.name}@${plugin.version}`)}`);
			}
		} else {
			console.log('No Yarn linked appcd plugins found.');
		}
	}
};
