# v1.4.0

 * Fixed plugin IPC tunnel to send the `"headers"` and `"source"` `DispatcherContext` properties.
   The `"data"` property has been renamed to `"request"` to match the `DispatcherContext` property
   name. [(DAEMON-273)](https://jira.appcelerator.org/browse/DAEMON-273)
 * Moved plugin config loading from the plugin implementation to the plugin registry where the
   the config is loaded when the plugin is registered. Config is unloaded when a plugin is
   unregistered.
 * Plugin config file changes no longer trigger plugin to be automatically stopped. Plugins are
   encouraged to watch the config for changes instead of reloading.
 * Fixed bug where plugins couldn't call their own routes without going across the bridge. To fix
   this, the child process' root dispatcher instance needed to be replaced with the plugin's scoped
   dispatcher instance.
 * Log messages from plugin child host processes are now formatted in the plugin host process
   before being passed over IPC to the parent because the inability to serialize complex object
   types.
 * Fixed bug where error was being thrown when trying to send a response stream error to the child
   host process.
 * Added hash of plugin's `package.json` to `Plugin` descriptor to assist with detecting plugin
   changes. [(DAEMON-251)](https://jira.appcelerator.org/browse/DAEMON-251)
 * Added check to the plugin schema's filesystem watcher callback when the plugin's `package.json`'s
   content changes to remove and re-add a plugin.
 * Updated dependencies.

# v1.3.0 (Mar 29, 2019)

 * Reimplemented the `/` endpoint using a `DataServiceDispatcher` so that the data can be filtered
   and subscribed to. This also fixes proper 404 handling.
 * Added support for plugins with scopes in their package name.
 * When requesting a plugin's status by name and version, it will return that specific plugin's
   info. If there is no specific version, an array of matches is returned. If no matches, a 404 is
   returned.
 * Added `appcd.fs.watch()` and `appcd.fs.unwatch()` which optimizes filesystem watching
   subscriptions.
 * Updated dependencies.

# v1.2.0 (Jan 24, 2019)

 * Upgraded to appcd-logger@2.0.0.

# v1.1.4 (Jan 16, 2019)

 * Added pluralize dependency since it was removed from snooplogg 2.
 * Refactored promises to async/await.
 * Updated dependencies.

# v1.1.3 (Nov 27, 2018)

 * Fixed plugin telemetry so that it doesn't send events during the initial scan or shutdown.
 * Fixed lint issue with code indention.
 * Added support for streamed responses through the IPC tunnel.
   [(DAEMON-262)](https://jira.appcelerator.org/browse/DAEMON-262)
 * Added list of plugin's services to the default plugin info route.
   [(DAEMON-265)](https://jira.appcelerator.org/browse/DAEMON-265)
 * Added `appcd-plugin` to the list of injected appcd packages into plugins.
 * Improved debug log namespace names.
 * Updated dependencies.

# v1.1.2 (May 24, 2018)

 * Updated dependencies:
   - appcd-agent 1.1.1 -> 1.1.2
   - appcd-client 1.1.0 -> 1.1.1
   - appcd-config 1.1.0 -> 1.1.1
   - appcd-config-service 1.1.0 -> 1.1.1
   - appcd-detect 1.1.0 -> 1.1.1
   - appcd-dispatcher 1.1.0 -> 1.1.1
   - appcd-fs 1.1.1 -> 1.1.2
   - appcd-fswatch-manager 1.0.0 -> 1.0.1
   - appcd-fswatcher 1.1.0 -> 1.1.1
   - appcd-gulp 1.1.1 -> 1.1.5
   - appcd-http 1.1.0 -> 1.1.1
   - appcd-logger 1.1.0 -> 1.1.1
   - appcd-machine-id 1.1.0 -> 1.1.1
   - appcd-nodejs 1.1.0 -> 1.1.1
   - appcd-path 1.1.0 -> 1.1.1
   - appcd-request 1.1.0 -> 1.1.1
   - appcd-response 1.1.0 -> 1.1.2
   - appcd-subprocess 1.1.0 -> 1.1.1
   - appcd-telemetry 1.1.0 -> 1.1.1
   - appcd-util 1.1.0 -> 1.1.1
   - appcd-winreg 1.1.0 -> 1.1.1
   - fs-extra 5.0.0 -> 6.0.1
   - ignore 3.3.7 -> 3.3.8
   - source-map-support 0.5.4 -> 0.5.6

# v1.1.1 (Apr 11, 2018)

 * Reset the plugin's `stack` message when the plugin is stopped.
 * Fixed error handling when a plugin fails to activate or deactivate.
 * Added `/appcd/plugin/status/:name?/:version?` service to get a plugin's status without invoking
   the plugin.

# v1.1.0 (Apr 9, 2018)

 * Enforce appcd version compatible check when loading a plugin.
   [(DAEMON-208)](https://jira.appcelerator.org/browse/DAEMON-208)
 * Automatically injecting the built-in `appcd-*` packages when required from the plugin when
   plugin `injectAppcdDependencies` property is not `false`.
 * Deprecated `appcd-plugin` property in plugin `packages.json` in favor of `appcd` property.
 * Plugin should fail to load if `appcd` section in `packages.json` is not an object.
   [(DAEMON-213)](https://jira.appcelerator.org/browse/DAEMON-213)
 * Added support for plugin to define wildcard paths to ignore and not unload the plugin when a
   file is changed. [(DAEMON-222)](https://jira.appcelerator.org/browse/DAEMON-222) and
   [(DAEMON-236)](https://jira.appcelerator.org/browse/DAEMON-236)
 * Added support for loading appcd plugins that are published as scoped packages.
   [(DAEMON-220)](https://jira.appcelerator.org/browse/DAEMON-220)
 * Fix bug where plugin scheme detection was preventing the daemon from shutting down.
   [(DAEMON-239)](https://jira.appcelerator.org/browse/DAEMON-239)
 * Plugin host is spawned with the current working directory set to the plugin path.
   [(DAEMON-234)](https://jira.appcelerator.org/browse/DAEMON-234)
 * Suppressed noisy warnings for packages that are not valid appcd plugins.
   [(DAEMON-223)](https://jira.appcelerator.org/browse/DAEMON-223)
 * Improved `appcd-plugin-host` process title to include plugin name, version, and path.
 * Improved readme.
 * Updated dependencies:
   - appcd-agent 1.0.1 -> 1.1.1
   - appcd-config 1.0.1 -> 1.1.0
   - appcd-config-service 1.0.1 -> 1.1.0
   - appcd-dispatcher 1.0.1 -> 1.1.0
   - appcd-fs 1.0.1 -> 1.1.1
   - appcd-fswatcher 1.0.1 -> 1.1.0
   - appcd-gulp 1.0.1 -> 1.1.1
   - appcd-logger 1.0.1 -> 1.1.0
   - appcd-path 1.0.1 -> 1.1.0
   - appcd-response 1.0.1 -> 1.1.0
   - appcd-subprocess 1.0.1 -> 1.1.0
   - appcd-util 1.0.1 -> 1.1.0
   - gawk 4.4.4 -> 4.4.5
   - semver 5.4.1 -> 5.5.0
   - source-map-support 0.5.0 -> 0.5.4
   - uuid 3.1.0 -> 3.2.1

# v1.0.1 (Dec 15, 2017)

 * Updated dependencies:
   - appcd-agent 1.0.0 -> 1.0.1
   - appcd-config 1.0.0 -> 1.0.1
   - appcd-config-service 1.0.0 -> 1.0.1
   - appcd-dispatcher 1.0.0 -> 1.0.1
   - appcd-fs 1.0.0 -> 1.0.1
   - appcd-fswatcher 1.0.0 -> 1.0.1
   - appcd-gulp 1.0.0 -> 1.0.1
   - appcd-logger 1.0.0 -> 1.0.1
   - appcd-path 1.0.0 -> 1.0.1
   - appcd-response 1.0.0 -> 1.0.1
   - appcd-subprocess 1.0.0 -> 1.0.1
   - appcd-util 1.0.0 -> 1.0.1
   - fs-extra 4.0.2 -> 5.0.0

# v1.0.0 (Dec 5, 2017)

 - Initial release.
