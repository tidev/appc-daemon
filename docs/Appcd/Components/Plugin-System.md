# ![Appc Daemon logo](../../images/appc-daemon.png) Daemon Project

## Plugin System

All service logic, such as the Appc CLI and Titanium, belongs in a plugin. These plugins are
controlled by the Plugin Manager.

### Plugin Manager

The Appc Daemon's plugin system is orchestrated by the Plugin Manager. It is responsible for
detecting, activating, and deactivating plugins. Plugin paths are registered with the Plugin Manager
and it will scan them for plugins.

### Plugin Paths

Plugin paths are registered with the Plugin Manager. A plugin path may be any of the following
schemes:

* A non-existend directory
* A path directly to a plugin directory
* A path to a directory containing one or more plugin directories
* A path to a directory of one or more nested plugin directories

When a plugin path is registered, the plugin path watched for a possible scheme change. For example,
the path may be a plugin directory, but then the plugin is deleted. The path will remain registered,
however the plugin defined within that path is deactivated and the scheme will change to a
non-existent directory scheme.

Plugin paths can be unregistered which will deactivate all plugins found in that path.

### Plugin Types

There are two types of plugins: internal and external.

Both types will load the plugins code in a wrapper that is executed in the same context as the host.
In other words, the plugin code is not run in a sandbox or a jail. It's free to do anything. The
wrapper simply exposes the `appcd` global variable as well as a namespaced logger bound to `console`
and a wrapped `require()` which will make sure all plugin dependencies are also wrapped.

#### Internal Plugins

Internal plugins are loaded in the same process as the daemon core. They can be deactivated, but
are never unloaded until the Appc Daemon shutdown. This makes internal plugins not reloadable.

Internal plugins should only be used if an external plugin does not suffice.

#### External Plugins

External plugins run in a plugin host subprocess and can be unloaded and reloaded.

The Plugin Manager communicates with the plugin host using an IPC tunnel and a message-based
protocol. Only serializable data types can be sent through the IPC tunnel. Functions, non-public
properties, and contexts cannot be sent.

If the plugin host exits with a non-zero exit code, the Plugin Manager will flag the plugin as
errored.

The external plugin controller will watch the plugin path, the path containing the main entry
script, and the `lib` and `src` directories in the `package.json` for changes. Any changes will
automatically reload the plugin. This is useful when developing plugins.

### Plugin Definition

A plugin is defined as a directory containing a `package.json` file and a "main" JavaScript file.

#### `package.json`

```json
{
	"name": "my-plugin",
	"version": "1.0.0",
	"main": "./dist/index",
	"directories": {
		"lib": "./lib",
		"src": "./src"
	},
	"appcd": {
		"name": "my-sweet-plugin",
		"type": "external",
		"allowProcessExit": false,
		"inactivityTimeout": 120000
	},
	"engines": {
		"node": ">=7.6.0"
	}
}
```

##### `name`

Required by NPM. The Appc Daemon only requires if it doesn't find an `appcd.name`. The name must
**not** be `appcd`.

The `name` is used to register the plugin. All requests dispatched to `/my-plugin/1.0.0/` will be
routed to the plugin. It's possible for the package name to be different from the desired plugin
name. In this case, use the `appcd` section to override the name.

The `name` is stripped of all invalid characters so that it's safe to use in a URL.

##### `version`

The semantic version of the plugin.

##### `main`

The path to the main JavaScript file. If this property is not defined, then it will attempt to
locate `./index.js`.

##### `directories`

An optional object containing a `lib` and/or `src` path. `lib` is standard for NPM packages. `src`
is not standard, but is known to be used.

For `external` plugins, these paths are added to the list of directories to watch for changes to
automatic reload the plugin when a file is changed.

##### `appcd`

An object that defines Appc Daemon specific settings.

##### `appcd.name`

The name to use to register the plugin namespace with the dispatcher. This overrides the `name`
property.

##### `appcd.type`

The plugin type. Must be `internal` or `external`. Defaults to `external`.

##### `appcd.allowProcessExit`

Applies to `external` plugins only. When `true`, allows `process.exit()` to work as expected. By
default, this is `false` and `process.exit()` is disabled.

`internal` plugins always disabled `process.exit()` so that it doesn't terminate the Appc Daemon.

##### `appcd.inactivityTimeout`

The number of milliseconds to wait since the last request to the plugin before it's automatically
deactivated. This only applies to `external` plugins.

##### `engines.node`

The Node.js version required to run the plugin.

For `internal` plugins, it checks if the Node.js version that the Appc Daemon Core is running and
checks that it satisfies the required Node.js version.

For `external` plugins, it will spawn the required Node.js version. If the version isn't installed,
it will automatically download it.

### Plugin Host

`external` plugins are run in a plugin host. The plugin host cannot be directly executed. It must
be spawned by Node.js.

The plugin host will exit with one of the following exit codes:

| Code  | Description                              |
| :---: | :--------------------------------------- |
| 0     | Success                                  |
| 1     | An error occurred                        |
| 2     | Plugin host cannot be directly executed  |
| 3     | Plugin path was not specified            |
| 4     | Invalid plugin type; must be `external`  |
| 5     | Incorrect Node.js version                |
| 6     | Failed to activate plugin                |

### Debugging Plugins

You can debug Appc Daemon plugins using the Google Chrome Dev Tools by setting the
`INSPECT_PLUGIN=<PLUGIN_NAME>` environment variable. You will see the URL in the log output.

By default, it starts the inspector on port `9230`, but you can change it by setting the
`INSPECT_PLUGIN_PORT=<PORT>` environment variable.
