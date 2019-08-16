# v3.0.1

 * chore: Fixed homepage and repository URLs in `package.json`.
 * chore: Added links to issue trackers in readme.
 * chore: Updated dependencies

# v3.0.0 (Aug 13, 2019)

 * BREAKING CHANGE: Updated to `appcd-machine-id@3.0.1`, `appcd-nodejs@3.0.0`,
   `appcd-subprocess@3.0.0`, `appcd-telemetry@3.0.0`, and `appcd-util@2.0.0`.
 * chore: Fixed eslint `hasOwnProperty` warnings.
 * chore: Updated dependencies.

# v2.2.0 (Jun 25, 2019)

 * chore: Updated to `appcd-config-service@2.0.0`.

# v2.1.0 (Jun 13, 2019)

 * chore: Updated to `appcd-client@2.0.0`, `appcd-config-service@1.2.3`, `appcd-detect@2.1.0`,
   `appcd-dispatcher@2.0.0`, `appcd-fswatch-manager@2.0.0`, `appcd-machine-id@2.0.1`,
   `appcd-nodejs@2.0.0`, `appcd-request@2.0.0`, `appcd-subprocess@2.0.1`, and
   `appcd-telemetry@2.0.1`.

# 2.0.0 (Jun 10, 2019)

 * BREAKING CHANGE: Updated to `appcd-detect@2.0.0`, `appcd-machine-id@2.0.0`, and
   `appcd-telemetry@2.0.0`.
 * fix: Replaced call to `formatWithOptions()` with `format()` so that appcd@1.x would not break
   on Node.js 8.11.2. [(DAEMON-281)](https://jira.appcelerator.org/browse/DAEMON-281)
 * fix: Fixed support for scoped plugin package names for nested directory schemes.

# 1.4.0 (Jun 4, 2019)

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

# v1.3.0 (Mar 29, 2019)

 * refactor: Reimplemented the `/` endpoint using a `DataServiceDispatcher` so that the data can be
   filtered and subscribed to. This also fixes proper 404 handling.
 * feat: Added support for plugins with scopes in their package name.
 * fix: When requesting a plugin's status by name and version, it will return that specific
   plugin's info. If there is no specific version, an array of matches is returned. If no matches,
   a 404 is returned.
 * feat: Added `appcd.fs.watch()` and `appcd.fs.unwatch()` which optimizes filesystem watching
   subscriptions.
 * chore: Updated dependencies.

# v1.2.0 (Jan 24, 2019)

 * chore: Upgraded to appcd-logger@2.0.0.

# v1.1.4 (Jan 16, 2019)

 * fixL Added pluralize dependency since it was removed from snooplogg 2.
 * refactor: Refactored promises to async/await.
 * chore: Updated dependencies.

# v1.1.3 (Nov 27, 2018)

 * fix: Fixed plugin telemetry so that it doesn't send events during the initial scan or shutdown.
 * fix: Fixed lint issue with code indention.
 * feat: Added support for streamed responses through the IPC tunnel.
   [(DAEMON-262)](https://jira.appcelerator.org/browse/DAEMON-262)
 * feat: Added list of plugin's services to the default plugin info route.
   [(DAEMON-265)](https://jira.appcelerator.org/browse/DAEMON-265)
 * feat: Added `appcd-plugin` to the list of injected appcd packages into plugins.
 * chore: Improved debug log namespace names.
 * chore: Updated dependencies.

# v1.1.2 (May 24, 2018)

 * chore: Updated dependencies.

# v1.1.1 (Apr 11, 2018)

 * fix: Reset the plugin's `stack` message when the plugin is stopped.
 * fix: Fixed error handling when a plugin fails to activate or deactivate.
 * feat: Added `/appcd/plugin/status/:name?/:version?` service to get a plugin's status without
   invoking the plugin.

# v1.1.0 (Apr 9, 2018)

 * feat: Enforce appcd version compatible check when loading a plugin.
   [(DAEMON-208)](https://jira.appcelerator.org/browse/DAEMON-208)
 * feat: Automatically injecting the built-in `appcd-*` packages when required from the plugin when
   plugin `injectAppcdDependencies` property is not `false`.
 * fix: Deprecated `appcd-plugin` property in plugin `packages.json` in favor of `appcd` property.
 * fix: Plugin should fail to load if `appcd` section in `packages.json` is not an object.
   [(DAEMON-213)](https://jira.appcelerator.org/browse/DAEMON-213)
 * feat: Added support for plugin to define wildcard paths to ignore and not unload the plugin when
   a file is changed. [(DAEMON-222)](https://jira.appcelerator.org/browse/DAEMON-222) and
   [(DAEMON-236)](https://jira.appcelerator.org/browse/DAEMON-236)
 * feat: Added support for loading appcd plugins that are published as scoped packages.
   [(DAEMON-220)](https://jira.appcelerator.org/browse/DAEMON-220)
 * fix: Fix bug where plugin scheme detection was preventing the daemon from shutting down.
   [(DAEMON-239)](https://jira.appcelerator.org/browse/DAEMON-239)
 * feat: Plugin host is spawned with the current working directory set to the plugin path.
   [(DAEMON-234)](https://jira.appcelerator.org/browse/DAEMON-234)
 * fix: Suppressed noisy warnings for packages that are not valid appcd plugins.
   [(DAEMON-223)](https://jira.appcelerator.org/browse/DAEMON-223)
 * chore: Improved `appcd-plugin-host` process title to include plugin name, version, and path.
 * chore: Improved readme.
 * chore: Updated dependencies.

# v1.0.1 (Dec 15, 2017)

 * chore: Updated dependencies.

# v1.0.0 (Dec 5, 2017)

 - Initial release.
