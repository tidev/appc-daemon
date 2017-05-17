# ![Appc Daemon logo](../..images/appc-daemon.png) Daemon Project

## Plugin System

All service logic, such as the Appc CLI and Titanium, belongs in a plugin. Appcd plugins are either
loaded internally or externally. Internal plugins are loaded in the same process as the daemon core
and cannot be unloaded. External plugins run in a plugin host subprocess and can be unloaded or
reloaded, but have limited plugin hook capabilities.

The Appc Daemon's plugin system is orchestrated by the PluginManager. It is responsible for detecting, loading, and unloading plugins. The Plugin Manager scans the built-in and user plugin directories for plugins, then registers them. Once a plugin is registered, it can be loaded, unloaded, or unregistered. Built-in plugins as well as any user specified plugins in the config file are loaded when the Appc Daemon starts.
A plugin is defined as a directory containing a package.json file and a "main" JavaScript file. The package.json must contain a name. Optionally, it may specify a main file to load, otherwise it falls back to index.js in the root of the plugin directory.
Plugin Interfaces
There are two supported plugin interfaces: "internal" and "external".
Internal Plugins
Internal plugins are directly require()'d into the daemon and cannot be unloaded once loaded until the daemon is restarted. Internal plugins are meant for core functionality or for plugins that need to listen to hooked functions where an argument is a function or the hooked function needs to be overwritten. The reason for the latter is because we cannot serialize a JavaScript function and its context and pass it over to the subprocess hosting the plugin via IPC.
External Plugins
External plugins are loaded in a subprocess called appcd-plugin-host. The plugin host is spawned by the PluginManager (via the SubprocessManager) and establishes an IPC channel between the daemon and the plugin host. The PluginManager can reload a plugin by simply killing the plugin host process and starting it again. All communication between the plugin host and the daemon is serialized and deserialized which prevents functions, contexts, and native non-serializable data from being transmitted.
The PluginManager is also able to detect when a plugin host has died and restart it.
