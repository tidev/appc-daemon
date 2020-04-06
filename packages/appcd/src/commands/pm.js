export default {
	commands: `${__dirname}/pm`,
	desc: 'appcd plugin manager',
	async action(ctx) {
		ctx.cmd.desc = `The plugin manager (pm) lists installed plugins, installs new plugins, updates
existing plugins, and uninstalls plugins.

To install the default plugins, run: appcd pm install default`;

		console.log(await ctx.help());
	}
};
