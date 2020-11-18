> [Home](../../../README.md) ➤ [Development](../../README.md) ➤ [Appc Daemon Development](../README.md) ➤ [Architecture](README.md) ➤ Plugin System

> :warning: Under construction.


# Plugin System

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

### Project Template

To get started with creating an Appc Daemon plugin, clone the
[appcd-plugin-template](https://github.com/appcelerator/appcd-plugin-template) repo and follow
the instructions in the `README.md`.

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
		"appcdVersion": "1.x",
		"autoStart": false,
		"ignore": [ "somedir", "somefile.*" ],
		"inactivityTimeout": 120000,
		"injectAppcdDependencies": true,
		"name": "my-sweet-plugin",
		"node": "8.10.0",
		"type": "external"
	}
}
```

#### Appcd Dependencies

##### Dependency Injection

Nearly all appcd plugins will need to depend on at least one other `appcd-*` dependency. However an
issue arises where critical parts of the Appc Daemon will fail if the `appcd-*` dependency used by
both the Appc Daemon and the plugin aren't the exact same version from the same exact directory.

The Node.js module loader resolves and caches packages by path. For example, if a plugin depends on
`appcd-dispatcher` and Node.js resolves it in the plugin's `node_modules` directory, then it will
load a second copy of `appcd-dispatcher`. Technically this works until the daemon performs an
`instanceof` check. If the supplied instance is not derived from the same `appcd-dispatcher`
package, then the `instanceof` check will fail and the plugin will not work properly.

We solve this by injecting the Appc Daemon's version of certain `appcd-*` dependencies into the
plugin system's module loader (i.e. `import` and `require()`).

The following table describes which `appcd-*` dependencies are auto-injected:

| Package               | Injectable        | Notes  |
| --------------------- | ----------------- | ------ |
| appcd                 | No                |        |
| appcd-agent           | Yes               |        |
| appcd-client          | Yes and should be |        |
| appcd-config          | Yes and should be |        |
| appcd-config-service  | Yes and should be |        |
| appcd-core            | No                |        |
| appcd-detect          | Yes and should be |        |
| appcd-dispatcher      | Yes and should be |        |
| appcd-fs              | Yes               |        |
| appcd-fswatcher       | Yes and should be |        |
| appcd-gulp            | No                |        |
| appcd-http            | Yes               |        |
| appcd-logger          | Yes               |        |
| appcd-machine-id      | Yes and should be |        |
| appcd-nodejs          | Yes and should be |        |
| appcd-path            | Yes               |        |
| appcd-plugin          | No                |        |
| appcd-response        | Yes and should be |        |
| appcd-subprocess      | Yes and should be |        |
| appcd-telemetry       | Yes               |        |
| appcd-util            | Yes               |        |

Injectable `appcd-*` packages do _not_ need to be added as a dependency in the plugin's
`package.json`. This helps keep the disk space requirements down.

##### Disabling Injection

However, there may be instances where a plugin does _not_ want all or specific `appcd-*`
dependencies to be injected.

A plugin can prevent all `appcd-*` injections by setting `appcd.injectAppcdDepenedencies` to `false`
in the plugin's `package.json`.

> :warning: Setting `appcd.injectAppcdDepenedencies` to `false` not only requires the plugin to
explicitly declare any `appcd-*` dependencies, but will also cause side effects, especially if the
the plugin uses any of the `appcd-*` packages above where it says "Yes and should be".

To disable injection for a specific `appcd-*` dependency, leave `appcd.injectAppcdDepenedencies`
enabled, but add the `appcd-*` dependencies to the `dependencies` in the `package.json` file. If the
injected version does not satisify the plugin's required version, the plugin system's module loader
will defer the loading to Node.js's module loader.

##### Pros of Injecting

 * Plugins use less disk space
 * No class duplication, so `instanceof` works as expected
 * Plugins benefit from bug fixes in updated of `appcd-*` dependencies

##### Cons of Injecting

 * Plugins may be authored against an older `appcd-*` package's public API that changes with a major
   revision

##### Best Practices

Plugins should set the `appcd.appcdVersion` in the plugin's `package.json` to the range (i.e. `1.x`)
of Appc Daemon versions it is compatible with.

Plugins should not declare injectable `appcd-*` dependencies in their `package.json`.

These two things will reduce required disk space, guarantee the injected `appcd-*` dependency
version is compatible with the plugin, and eliminate any `instanceof` issues.

#### `package.json` Configuration

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

An object that defines Appc Daemon specific settings as the following describes.

##### `appcd.appcdVersion`

An optional semver range that describes the Appc Daemon versions the plugin is compatible with. By
default, the plugin is compatible with all versions of Appc Daemon.

> :bulb: If `appcd.injectAppcdDependencies` is enabled (i.e. not `false`), the plugin system *could*
> inject an `appcd-*` dependency with a public API that is _not_ compatible with the plugin.

> :warning: If a plugin uses an `appcd-*` package version that differs from the ones used by the
> Appc Daemon, multiple class definitions will exist and critical `instanceof` checks will fail.

##### `appcd.autoStart`

When `true`, the plugin is started when the plugin is discovered. If the plugin stops without
error, it is automatically restarted.

##### `appcd.config`

An optional path to the plugin's config file that contains the default config settings and metadata
for each config setting.

##### `appcd.ignore`

An optional array of file and directory patterns to ignore for the external plugin auto-reload
mechanism.

##### `appcd.name`

The name to use to register the plugin namespace with the dispatcher. This overrides the `name`
property.

##### `appcd.os`

An optional array of platform names that the plugin is compatible with. Value can contain `darwin`,
`linux`, and `win32`. By default, no platform restrictions are enforced.

##### `appcd.type`

The plugin type. Must be `internal` or `external`. Defaults to `external`.

##### `appcd.injectAppcdDependencies`

When `true` (default) and a plugin attempts to `import` or `require()` an `appcd-*` package, the
module loader will return a reference to the version used internally by the Appc Daemon.

> :warning: If `appcd.injectAppcdDependencies` is disabled, then the plugin could load another
> definition for the same `appcd-*` dependency which will cause `instanceof` checks to fail and
> could cause the plugin to not work correctly.

##### `appcd.inactivityTimeout`

The number of milliseconds to wait since the last request to the plugin before it's automatically
deactivated. This only applies to `external` plugins.

##### `appcd.node`

The Node.js version required to run the plugin.

For `internal` plugins, it checks if the Node.js version that the Appc Daemon Core is running and
checks that it satisfies the required Node.js version.

For `external` plugins, it will spawn the required Node.js version. If the version isn't installed,
it will automatically download it.

If `appcd.node` is not set, the plugin system will use `engines.node` if set.

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
`APPCD_INSPECT_PLUGIN=<PLUGIN_NAME>` environment variable. You will see the URL in the log output.

By default, it starts the inspector on port `9230`, but you can change it by setting the
`APPCD_INSPECT_PLUGIN_PORT=<PORT>` environment variable.
