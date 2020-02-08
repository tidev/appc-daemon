# Appc Daemon 2.3.0

## Jun 04, 2019

This is a minor release with new features, bug fixes, and dependency updates.

### Installation

```
npm i -g appcd@2.3.0
```

### appcd@2.3.0

 * BREAKING CHANGE: Bumped minimum required Node.js version from v8.10.0 to v8.12.0.
 * fix: Changed `--debug` flag for `start` and `restart` commands so that it no longer starts the
   Node.js debugger.
 * feat: Added `--debug-inspect` flag to the `start` and `restart` commands that connects the
   Node.js debugger.
 * fix: Changed the Node.js debugger port to the default port of `9229`.
 * fix: Fixed config list to show empty arrays.
 * fix: Fixed SIGINT and SIGTERM signal handlers when debugging.
 * chore: Updated dependencies.

### appcd-agent@1.1.6

 * chore: Updated dependencies.

### appcd-client@1.3.1

 * fix: Fixed unhandled exception when attempting to spawn the Appc Daemon.

### appcd-client@1.3.2

 * chore: Updated dependencies.

### appcd-config@1.3.0

 * refactor: Complete refactor to support config namespaces.
   [(DAEMON-274)](https://jira.appcelerator.org/browse/DAEMON-274)
 * chore: Updated dependencies.

### appcd-config-service@1.2.2

 * fix: Removed redundant validation code when loading a config file.
 * feat: Added action handler for unloading a config file.
 * chore: Added more debug logging.
 * chore: Updated dependencies.

### appcd-core@2.3.0

 * BREAKING CHANGE: Bumped minimum required Node.js version from v8.10.0 to v8.12.0.
 * refactor: Refactored shutdown handler to use async/await.
 * chore: Updated telemetry config settings to latest endpoint.
 * chore: Updated dependencies.

### appcd-default-plugins@1.2.0

 * chore: Updated dependencies.

### appcd-dispatcher@1.4.1

 * chore: Updated dependencies.

### appcd-fs@1.1.7

 * chore: Updated dependencies.

### appcd-fswatch-manager@1.1.2

 * chore: Updated dependencies.

### appcd-fswatcher@1.2.2

 * chore: Updated dependencies.

### appcd-gulp@2.1.1

 * fix: Added huge timeout when debugging tests.
 * chore: Updated dependencies.

### appcd-http@1.2.2

 * chore: Updated dependencies.

### appcd-logger@2.0.2

 * chore: Updated dependencies.

### appcd-nodejs@1.2.2

 * fix: Removed dependency on `tmp` package so that its SIGINT handler doesn't force exit the
   program.
 * chore: Updated dependencies.

### appcd-path@1.1.6

 * chore: Updated dependencies.

### appcd-plugin@1.4.0

 * BREAKING CHANGE: Bumped minimum required Node.js version from v8.0.0 to v8.12.0.
 * fix: Fixed plugin IPC tunnel to send the `"headers"` and `"source"` `DispatcherContext`
   properties. The `"data"` property has been renamed to `"request"` to match the
   `DispatcherContext` property name.
   [(DAEMON-273)](https://jira.appcelerator.org/browse/DAEMON-273)
 * fix: Moved plugin config loading from the plugin implementation to the plugin registry where the
   the config is loaded when the plugin is registered. Config is unloaded when a plugin is
   unregistered.
 * fix: Plugin config file changes no longer trigger plugin to be automatically stopped. Plugins
   are encouraged to watch the config for changes instead of reloading.
 * fix: Fixed bug where plugins couldn't call their own routes without going across the bridge. To
   fix this, the child process' root dispatcher instance needed to be replaced with the plugin's
   scoped dispatcher instance.
 * fix: Log messages from plugin child host processes are now formatted in the plugin host process
   before being passed over IPC to the parent because the inability to serialize complex object
   types.
 * fix: Fixed bug where error was being thrown when trying to send a response stream error to the
   child host process.
 * fix: Added hash of plugin's `package.json` to `Plugin` descriptor to assist with detecting
   plugin changes. [(DAEMON-251)](https://jira.appcelerator.org/browse/DAEMON-251)
 * fix: Added check to the plugin schema's filesystem watcher callback when the plugin's
   `package.json`'s content changes to remove and re-add a plugin.
 * DEPRECATION: `appcd-winreg` will be removed in v2.0.0 and thus will not be implicitly loaded.
   Plugins will need to either migrate to `winreglib` or explicitly depend on `appcd-winreg`.
   [(DAEMON-277)](https://jira.appcelerator.org/browse/DAEMON-277)
 * chore: Updated dependencies.

### appcd-request@1.2.2

 * chore: Updated dependencies.

### appcd-response@2.0.0

 * BREAKING CHANGE: Bumped minimum required Node.js version to v8.12.0.
 * feat: Replaced `appcd-winreg` with `winreglib`.
   [(DAEMON-276)](https://jira.appcelerator.org/browse/DAEMON-276)
 * chore: Updated dependencies.

### appcd-subprocess@1.3.1

 * chore: Updated dependencies.

### appcd-util@1.1.7

 * chore: Updated dependencies.

### appcd-winreg@1.1.6

 * chore: Added deprecation notice to readme.
 * chore: Updated dependencies.