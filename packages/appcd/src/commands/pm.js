export default {
	commands: `${__dirname}/pm`,
	desc: 'list, install, update, search, and uninstall appcd plugins',
	async action(ctx) {
		console.log('The plugin manager lists installed plugins, installs new plugins, and updates or uninstalls plugins.');
		console.log();
		console.log('The Appc Daemon does not bundle any plugins and thus they must be manually installed. To install the default set of plugins, run:\n');
		console.log('    appcd pm install default\n');

		ctx.cmd.desc = '';

		console.log(await ctx.help());
	}
};
