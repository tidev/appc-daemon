export default {
	args: [
		{
			name: 'name',
			desc: 'The plugin name',
			required: true
		}
	],
	desc: 'Create a new plugin project',
	help: {
		header: 'Create a new plugin project in a subdirectory.',
		footer: ({ style }) => `${style.heading('Getting Started:')}

Before you begin, you must install Yarn 1.x. Please refer to Yarn's docs for installation \
instructions: ${style.highlight('https://classic.yarnpkg.com/en/docs/install')}.

  1. Choose a project name:
       The project name must be a valid npm package name. It is encouraged to prefix the name with "appcd-plugin-".

  2. Create the plugin project:
       ${style.highlight('appcd pm new appcd-plugin-foo')}

  3. Build the plugin:
       ${style.highlight('yarn run build')}

  4. Wire up the Yarn link and register the Yarn links with the Appc Daemon plugin system:
       ${style.highlight('yarn link && appcd pm link')}

  5. Ensure the Appc Daemon is running:
       ${style.highlight('appcd start')}

  6. Test your plugin:
       ${style.highlight('appcd exec /foo/latest')}

  7. Develop your plugin:
       To speed up development, start the watch script:
         ${style.highlight('yarn run watch')}

       As you add code, the watch script will automatically rebuild your plugin. The Appc Daemon \
will see the plugin change and stop the old plugin from running. All you need to do is re-execute \
your plugin!

       To view debug logs, you can run:
         ${style.highlight('appcd logcat "*foo*"')}

Please refer to the plugin system docs for information about plugin development, plugin types, \
lifecycle, package.json settings, appcd-* dependencies, and debugging: \
${style.highlight('https://github.com/appcelerator/appc-daemon/blob/master/docs/Components/Plugin-System.md')}`
	},
	options: {
		'-d, --dest [path]': 'The directory to create the project in',
		'-t, --template [path|url]': 'A path or URL to the template to use'
	},
	async action({ argv, console }) {
		const [
			{ plugins: pm },
			{ snooplogg },
			{ getAppcdCoreNodeVersion },
			path,
			semver,
		] = await Promise.all([
			import('appcd-core'),
			import('appcd-logger'),
			import('../../common'),
			import('path'),
			import('semver')
		]);

		const { bold, cyan, red, yellow } = snooplogg.chalk;

		const { pluginName, serviceName } = await new Promise(resolve => {
			pm.create({
				dest: argv.dest || path.join(process.cwd(), argv.name),
				name: argv.name,
				template: argv.template
			})
				.on('status', msg => console.log(msg))
				.on('error', err => console.error(red(err.toString())))
				.on('finish', resolve);
		});

		console.log(`Plugin created successfully!

Next steps:
  ${cyan(`cd ${pluginName}`)}

Build your plugin:
  ${cyan('yarn run build')}

Link your plugin:
  ${cyan('yarn link')}
  ${cyan('appcd pm link')}

Ensure the Appc Daemon is running:
  ${cyan('appcd start')}

Test your plugin:
  ${cyan(`appcd exec /${serviceName}/latest`)}

Develop your plugin:
  ${cyan('yarn run watch')}

View debug logs:
  ${cyan(`appcd logcat "*${serviceName}*"`)}
`);

		const coreNodeVer = getAppcdCoreNodeVersion();
		if (semver.major(coreNodeVer) !== semver.major(process.versions.node)) {
			console.log(bold(yellow('Warning!')));
			console.log(yellow(`Your current Node.js version is ${process.version}, however your plugin will be run in Node.js v${coreNodeVer}.`));
			console.log(yellow(`If your plugin uses any native addons, you will need to use Node.js v${coreNodeVer} also.\n`));
		}

		console.log('Read the README.md for more information. Have fun!');
	}
};
