# ![Appc Daemon logo](../../images/appc-daemon.png) Daemon Project

## Plugin System

All service logic, such as the Appc CLI and Titanium, belongs in a plugin. These plugins are
controlled by the Plugin Manager.

### Plugin Manager

The Appc Daemon's plugin system is orchestrated by the Plugin Manager. It is responsible for
detecting, activating, and deactivating plugins. Plugin paths are registered with the Plugin Manager and
it will scan them for plugins.

### Plugin Paths

Plugin paths are registered with the Plugin Manager. A plugin path may be a path directly to a
plugin directory, a path to a directory containing a plugin directory, or a path to a directory of
plugin directories.

Plugin paths can be unregistered which will stop all plugins found in that path.

### Plugin Definition

A plugin is defined as a directory containing a `package.json` file and a "main" JavaScript file.
The `package.json` must contain a `name` or `appcd` `name` property as well as a version.

The `package.json` may also indicate a specific "main" JavaScript file to load. If not present, then
it falls back to an `index.js` in the root of the plugin directory.

### Plugin Types

There are two types of plugins: internal and external. The plugin code is executed in a sandbox and
has limited access to the Node.js global object and Appc Daemon.

#### Internal Plugins

Internal plugins are loaded in the same process as the daemon core. They can be deactivated, but
are never unloaded until the Appc Daemon shutdown. This makes internal plugins not reloadable.

Internal plugins should only be used if the plugin needs to use function hooks.

#### External Plugins

External plugins run in a plugin host subprocess and can be unloaded or reloaded, however they are
unable to use function hooks.

The Plugin Manager communicates with the plugin host using an IPC tunnel and a message-based
protocol. Only serializable data types can be sent through the IPC tunnel. Functions, non-public
properties, and contexts cannot be sent.

If the plugin host exits with a non-zero exit code, the Plugin Manager will flag the plugin as
errored.
