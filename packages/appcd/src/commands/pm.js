export default {
	commands: `${__dirname}/pm`,
	desc: 'List, install, update, search, and uninstall appcd plugins',
	help: {
		header: ({ style }) => `The plugin manager lists installed plugins, installs new plugins, and updates or uninstalls plugins.

The Appc Daemon does not bundle any plugins and thus they must be manually installed. To install the default set of plugins, run: ${style.highlight('appcd pm install default')}`,

		footer: ({ style }) => `${style.heading('Examples:')}

  Search npm for an appcd plugin:
    ${style.highlight('appcd pm search')}

  or with a filter:
    ${style.highlight('appcd pm search android')}

  Install a plugin:
    ${style.highlight('appcd pm install @appcd/plugin-android')}

  Install all default plugins:
    ${style.highlight('appcd pm install default')}

  Uninstall a plugin:
    ${style.highlight('appcd pm uninstall default')}`
	},
	action({ argv, cli }) {
		// since we're in a sub-context, we don't have access to the built-in help command and thus we
		// have to re-dispatch the help command
		return cli.exec([ 'pm', '--help', ...(argv.json ? [ '--json' ] : []) ], { exitCode: 0 });
	}
};
