> [Home](../README.md) ➤ [CLI](README.md) ➤ pm

# `pm`

The Appc Daemon plugin manager lists installed plugins, installs new plugins, and updates or
uninstalls plugins.

> :bulb: Note: The Appc Daemon does not bundle any plugins. They must be manually installed.

## Actions

 * `i`, `install` - Install appcd plugins
 * `ln`, `link` - Register Yarn linked appcd plugins
 * `ls`, `list` - Lists all installed plugins
 * `new` - Create a new plugin project
 * `s`, `search` - Search npm for appcd plugins
 * `rm`, `uninstall` - Uninstall appcd plugins
 * `up`, `update` - Check and install plugin updates
 * `info`, `view` - Display info for an appcd plugin

## `i`, `install`

Installs an appcd plugin. Multiple versions of the same appcd plugin may be installed
simultaneously.

	appcd pm i <name>[@<version>] [--json]
	# or
	appcd pm install <name>[@<version>] [--json]

More than one package can be specified:

	appcd pm install <name>[@<version>] <name>[@<version>] <name>[@<version>]

The `install` command supports a special package name `"default"` that will download and install
the most recent major versions for each plugin in the list of default plugins defined in the Appc
Daemon's core package.

	appcd pm install default

### Options

 * #### `--json`
   Output information about the installed plugins as JSON.

### Examples

	appcd pm i @appcd/plugin-amplify

	appcd pm i @appcd/plugin-ios@1.5.2

## `ln`, `link`

Symlinks appcd plugins from a local `appc-daemon` git repo directory to the appcd plugins
directory. This command is intended for development purposes. Running this command outside of a
development environment will have no effect.

	appcd pm ln
	# or
	appcd pm link

### Options

 * #### `--json`
   Outputs the results as JSON.

## `ls`, `list`

Lists all appcd plugins found in the appcd home directory and the global `node_modules` directory.

	appcd pm ls
	# or
	appcd pm list

### Options

 * #### `-d`, `--detailed`
   Display detailed plugin information.
 * #### `--json`
   Outputs the results as JSON.

## `new`

Creates a new appcd plugin project.

	appcd pm new <name>

> Before you begin, you must install Yarn 1.x. Please refer to
> [Yarn's documentation](https://classic.yarnpkg.com/en/docs/install) for installation instructions.

  1. Choose a project name. \
     The project name must be a valid npm package name. It is encouraged to prefix the name with
	 `"appcd-plugin-"`.

  2. Create the plugin project: \
       `appcd pm new appcd-plugin-foo`

  3. Build the plugin: \
     `yarn run build`

  4. Wire up the Yarn link and register the Yarn links with the Appc Daemon plugin system: \
       `yarn link && appcd pm link`

  5. Ensure the Appc Daemon is running: \
       `appcd start`

  6. Test your plugin: \
       `appcd exec /foo/latest`

  7. Develop your plugin: \
     To speed up development, start the watch script: `yarn run watch`.

As you add code, the watch script will automatically rebuild your plugin. The Appc Daemon will see
the plugin change and stop the old plugin from running. All you need to do is re-execute your
plugin!

To view debug logs, you can run: `appcd logcat "*foo*"`.

Please refer to the [plugin system docs](../Development/Components/Plugin-System.md) for
detailed information about plugin development, plugin types, lifecycle, package.json settings,
`appcd-*` dependencies, and debugging.

### Arguments

 * #### `name`
   A appcd plugin project name.

### Options

 * #### `-d`, `--dest [path]`
   The directory to create the project in.
 * #### `-t`, `--template [path|url]`
   A path or URL to the template to use.

## `s`, `search`

Search npm for appcd plugins.

	appcd pm search [keyword]

### Arguments

 * #### `keyword`
   A string to search package names for.

### Options

 * #### `--json`
   Outputs the results as JSON.
 * #### `--show-deprecated`
   Show deprecated plugins.

## `rm`, `uninstall`

Uninstalls one or more appcd plugins.

	appcd pm rm <pkg>[@<ver>]
	# or
	appcd pm uninstall <pkg>[@<ver>]

You may specify multiple packages to uninstall:

	appcd pm rm <pkg>[@<ver>] <pkg>[@<ver>] <pkg>[@<ver>]

### Arguments

 * #### `plugins...`
   One or more plugin packages names to uninstall.

### Options

 * #### `--json`
   Outputs the results as JSON.

## `up`, `update`

Check if any of the installed appcd plugins have updates and installs the updates.

	appcd pm up [plugins...]
	# or
	appcd pm update [plugins...]

### Arguments

 * #### `plugins...`
   One or more plugin packages names to uninstall. If not specified, all plugins are updated.

### Options

 * #### `--json`
   Outputs the results as JSON.
 * #### `-y`, `--yes`
   Perform the updates without prompting to confirm updates.

## `info`, `view`

Retrieves info for an appcd plugin from npm and displays it.

	appcd pm info <pkg>[@<ver>] [filter]
	# or
	appcd pm view <pkg>[@<ver>] [filter]

For example, get the version of the latest iOS appcd plugin:

	appcd pm view @appcd/plugin-ios version

### Arguments

 * #### `pkg[@ver]`
   The plugin package name and version.
 * #### `filter`
   Display specific plugin fields such as `version`. If not specified, all information is returned.

### Options

 * #### `--json`
   Outputs the info as JSON.

## Exit Codes

| Code  | Description         |
| :---: | :------------------ |
|   0   | Success             |
|   1   | An error occurred   |
|   2   | Showed help screen  |
