# Appc Daemon 4.0.0

## Jan 22, 2021

This is a major release with breaking changes, new features, bug fixes, and dependency updates.

### Installation

```
npm i -g appcd@4.0.0
```

### appcd

 * **v4.0.0** - 1/22/2021

   * BREAKING CHANGE: Requires Node.js 10.19.0 or newer.
     [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
   * BREAKING CHANGE: The default appcd plugins are no longer installed as dependencies of `appcd`.
     The npm post-install script will attempt to install them, but if `appcd` was globally installed
     on a macOS or Linux machine, then it will likely fail due to permission issues and display a
     message saying to manually install them by running `appcd pm install default`.
   * BREAKING CHANGE(config): `config` command no longer returns status as apart of JSON output.
   * BREAKING CHANGE(config): `config` command does not return current value when doing a `set`,
     `push`, or `unshift`.
   * BREAKING CHANGE(config): `config list` command no longer supports filtering, use `config get`
     instead.
   * BREAKING CHANGE(config): Write operations such as `set` return `"OK"` instead of `"Saved"`.
   * BREAKING CHANGE(config): All network related environment variables have been removed in favor
     of the config file.
   * feat(status): Added appcd CLI version to status output.
   * feat(status): Added Plugin API Version to the status output.
     [(DAEMON-314)](https://jira.appcelerator.org/browse/DAEMON-314)
   * feat: Added `pm` command for managing appcd plugins.
     [(DAEMON-311)](https://jira.appcelerator.org/browse/DAEMON-311)
   * feat: Added additional documentation and examples to the help output for some commands.
   * feat: Show aliases in help for commands such as `config` and `pm`.
   * feat(status): Added new "Health" section to status output.
   * feat: Added notificaiton if new version is available.
   * feat(action): Added install default plugins action.
   * feat(scripts): Added uninstall script to stop the daemon if running.
   * refactor: Updated to latest `AppcdConfig` usage where `save()` is now synchronous and we no
     longer need to set the config file to save to since it uses the same file path that was used to
     load the config.
   * refactor(config): Replaced config action with subcommands for cleaner code and improved help
     information.
   * refactor: Replaced `cli-table2` with `cli-table3`.
   * refactor(config): Do not show the banner for `config` related commands.
   * refactor(status): Cleaned up plugin list.
   * refactor(status): Replace user's home directory references in plugin and subprocess paths with
     `~`.
   * refactor(request): Replaced `appcd-request` with `@axway/amplify-request` which adds proxy
     support.
   * fix(exec): Renamed `"json"` argument to `"data"`. The `exec` command does not have a  `--json`
     flag, however if it's passed in, the `"json"` value will be set to `true` instead of an object
     containing the request data payload.
   * fix(debug): Fixed graceful shutdown when running the daemon in debug mode.
   * fix: Set `APPCD` environment variable for all command, not just starting the server.
   * chore: Updated dependencies.

### appcd-agent

 * **v2.0.3** - 1/22/2021

   * chore: Updated dependencies.

 * **v2.0.2** - 1/5/2021

   * chore: Updated dependencies.

 * **v2.0.1** - 12/1/2020

   * chore: Updated dependencies.

 * **v2.0.0** - 6/12/2020

   * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
     [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
   * chore: Updated dependencies.

### appcd-client

 * **v3.0.3** - 1/22/2021

   * chore: Updated dependencies.

 * **v3.0.2** - 1/5/2021

   * chore: Updated dependencies.

 * **v3.0.1** - 12/1/2020

   * fix: Replaced AMPLIFY CLI references with Axway CLI.
   * chore: Updated dependencies.

 * **v3.0.0** - 6/12/2020

   * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
     [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
   * feat: Added `startDaemon` flag to `request()` method which passes it through to `connect()`.
   * chore: Updated dependencies.

### appcd-config

 * **v3.0.3** - 1/22/2021

   * chore: Updated dependencies.

 * **v3.0.2** - 1/5/2021

   * chore: Updated dependencies.

 * **v3.0.1** - 12/1/2020

   * refactor: Cleaned up AppcdConfig constructor.
   * chore: Updated dependencies.

 * **v3.0.0** - 6/12/2020

   * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
     [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
   * BREAKING CHANGE: `appcd-config` is no longer a general purpose config management system. It is
     solely intended to be used internally by the Appc Daemon. Packages dependent on `appcd-config`
     should migrate to `cfg-kit`.
   * BREAKING CHANGE: Metadata has been removed.
   * BREAKING CHANGE: `save()` is no longer asynchronous and thus does not return a promise.
   * chore: Updated dependencies.

### appcd-config-service

 * **v3.1.2** - 1/22/2021

   * chore: Updated dependencies.

 * **v3.1.1** - 1/5/2021

   * chore: Updated dependencies.

 * **v3.1.0** - 12/1/2020

   * feat: Added config file live reloading.
   * fix: Unload the config layer if the watched config file is deleted.
   * chore: Updated dependencies.

 * **v3.0.0** - 6/12/2020

   * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
     [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
   * BREAKING CHANGE: Deleting non-existent key returns successfully.
   * BREAKING CHANGE: `set`, `push`, and `unshift` no longer return the current value.
   * refactor: Updated to `appcd-config@3.0.0`, but no major breaking changes as far as the
     `ConfigService` is concerned.
   * chore: Updated dependencies.

### appcd-core

 * **v4.2.1** - 1/22/2021

   * fix(plugins): Added appcd, appcd core, and plugin API version to plugin monorepo
     `package.json`.
   * chore: Updated dependencies.

 * **v4.2.0** - 1/5/2021

   * feat: Added appcd CLI version to status.
   * chore: Updated core to use Node.js 14.15.4.
   * chore: Updated dependencies.

 * **v4.1.1** - 12/3/2020

   * chore: Updated `appcd-plugin` dependency.

 * **v4.1.0** - 12/2/2020

   * feat(plugins): Added support for the plugin `autoStart` flag.
   * chore: Updated `appcd-plugin` dependency.

 * **v4.0.1** - 12/2/2020

   * fix(plugins): Fixed bugged code when the spawn code was refactored.

 * **v4.0.0** - 12/2/2020

   * BREAKING CHANGE: Requires Node.js 10.19.0 or newer.
     [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
   * BREAKING CHANGE: Bumped core Node.js version to 14.15.1 LTS. This affects all plugins.
     [(DAEMON-319)](https://jira.appcelerator.org/browse/DAEMON-319)
   * BREAKING CHANGE: Main file exports library instead of the main entry point.
   * BREAKING CHANGE(status-monitor): Daemon uptime has changed from seconds to milliseconds.
   * BREAKING CHANGE(config): Removed network config options: `agentOptions` and `passphrase`.
   * BREAKING CHANGE(config): Combined network config options `httpProxy` to `httpsProxy` into single
     `network.proxy` setting.
   * feat: Added plugin management functions. This feature has removed the need for
     `appcd-default-plugins` and the associated `plugins.installDefault` config setting.
     [(DAEMON-311)](https://jira.appcelerator.org/browse/DAEMON-311)
   * feat(server): Stop config service when daemon is gracefully shutdown.
   * feat(server): Added import for `android.buildTools.selectedVersion` Titanium config setting.
   * feat(server): Added `state` property to indicate if the server stopped, starting, started, or
     stopping.
   * feat(status): Added machine id to status info.
   * refactor: Updated to `appcd-config@3.x`, created the Appc Daemon config schema, and converted
     the `default.js` config to `default.json`.
   * refactor: Removed Titanium CLI Genymotion config import.
     [(DAEMON-313)](https://jira.appcelerator.org/browse/DAEMON-313)
   * refactor: Changed default appcd home directory from `~/.appcelerator/appcd` to `~/.axway/appcd`
     and migrate the old home directory to the new location.
   * fix(websocket-session): Removed `message` from response if `undefined` so that msgpack cannot
     convert it to `null`.
   * fix(server): Add guard around server shutdown to prevent multiple shutdown sequences at the same
     time.
   * fix: Cast the process id to a string when writing the pid file.
   * fix(status-monitor): Fixed bug where status was reporting incorrect uptime in debug log.
   * fix(telemetry): Lowered telemetry send timeout from 1 minute to 10 seconds to prevent a long
     hang during telemetry shutdown while it waits to send a batch of events.
   * fix(server): Decouple shutdown trigger from server by moving to main entry script.
   * fix(server): Replaced AMPLIFY CLI references with Axway CLI.
   * fix(plugin): Added HTTPS proxy check and error if strictSSL is disabled.
   * fix(websocket-session): Add support for clients that do not send HTTP headers.
   * chore: Updated dependencies.

### appcd-default-plugins

 * **v4.2.1** - 3/3/2020

   * fix: Explicitly update PATH environment variable so that it is properly inherited by the child
     process on Windows. [(DAEMON-330)](https://jira.appcelerator.org/browse/DAEMON-330)
   * fix: Create missing `lerna.cmd` and `yarn.cmd` scripts needed for Windows.
     [(DAEMON-332)](https://jira.appcelerator.org/browse/DAEMON-332)
   * chore: Updated dependencies.

### appcd-detect

 * **v3.1.2** - 1/22/2021

   * chore: Updated dependencies.

 * **v3.1.1** - 1/5/2021

   * chore: Updated dependencies.

 * **v3.1.0** - 12/1/2020

   * fix: Bumped minimum Node.js requirement to 10.19.0 to prevent warnings on install.
   * chore: Updated dependencies.

 * **v3.0.0** - 6/12/2020

   * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
     [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
   * chore: Updated dependencies.

### appcd-dispatcher

 * **v3.1.2** - 1/22/2021

   * chore: Updated dependencies.

 * **v3.1.1** - 1/5/2021

   * chore: Updated dependencies.

 * **v3.1.0** - 12/1/2020

   * feat(DispatcherContext): Default `DispatcherContext` response as a `PassThrough` stream.
   * feat(DataServiceDispatcher): Added `setData()` method so that consumers don't need to directly
     depend on `gawk`.
   * feat(DataServiceDispatcher): Added path override to disable default `filter` path param.
   * feat: Added instance id to dispatcher debug logging.
   * chore: Updated dependencies.

 * **v3.0.0** - 6/12/2020

   * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
     [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
   * chore: Updated dependencies.

### appcd-fs

 * **v2.0.3** - 1/22/2021

   * chore: Updated dependencies.

 * **v2.0.2** - 1/5/2021

  * chore: Updated dependencies.

 * **v2.0.1** - 12/1/2020

   * chore: Updated dependencies.

 * **v2.0.0** - 6/12/2020

   * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
     [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
   * chore: Updated dependencies.

### appcd-fswatch-manager

 * **v3.0.3** - 1/22/2021

   * chore: Updated dependencies.

 * **v3.0.2** - 1/5/2021

  * chore: Updated dependencies.

 * **v3.0.1** - 12/1/2020

   * chore: Updated dependencies.

 * **v3.0.0** - 6/12/2020

   * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
     [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
   * chore: Updated dependencies.

### appcd-fswatcher

 * **v2.0.3** - 1/22/2021

   * chore: Updated dependencies.

 * **v2.0.2** - 1/5/2021

   * chore: Updated dependencies.

 * **v2.0.1** - 12/1/2020

   * fix: Fixed bug when recursively watching with a depth a non-existent directory that is created
     with subdirectories where the depths were being reset when the node is reinitialized.
   * fix: Fixed bug where notification depth counter was off by 1 when emitting the 'add' event for a
     new subdirectory to parent nodes.
   * chore: Updated dependencies.

 * **v2.0.0** - 6/12/2020

   * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
     [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
   * chore: Updated dependencies.

### appcd-gulp

 * **v3.1.2** - 1/22/2021

   * chore: Updated dependencies.

 * **v3.1.1** - 1/5/2021

   * chore: Updated dependencies.

 * **v3.1.0** - 12/1/2020

   * feat: Added Babel config for Node 14.
   * fix: Explicitly set Node.js API warnings to >=10.
   * fix: Added `--debug` flag for tests since `--inspect` is sometimes intercepted by gulp.
   * chore: Updated dependencies.

 * **v3.0.1** - 6/12/2020

   * chore: Updated dependencies.

 * **v3.0.0** - 5/1/2020

   * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
     [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
   * chore: Updated dependencies.

 * **v2.4.0** - 2/4/2020

   * feat: Added optional chaining Babel plugin.
   * chore: Updated dependencies.

### appcd-http

 * **v2.0.3** - 1/22/2021

   * chore: Updated dependencies.

 * **v2.0.2** - 1/5/2021

   * chore: Updated dependencies.

 * **v2.0.1** - 12/1/2020

   * chore: Updated dependencies.

 * **v2.0.0** - 6/12/2020

   * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
     [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
   * chore: Updated dependencies.

### appcd-logger

 * **v3.0.3** - 1/22/2021

   * chore: Updated dependencies.

 * **v3.0.2** - 1/5/2021

   * chore: Updated dependencies.

 * **v3.0.1** - 12/1/2020

   * chore: Updated dependencies.

 * **v3.0.0** - 6/12/2020

   * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
     [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
   * chore: Updated dependencies.

### appcd-machine-id

 * **v4.1.2** - 1/22/2021

   * chore: Updated dependencies.

 * **v4.1.1** - 1/5/2021

   * chore: Updated dependencies.

 * **v4.1.0** - 12/1/2020

   * fix: Bumped minimum Node.js requirement to 10.19.0 to prevent warnings on install.
   * chore: Updated dependencies.

 * **v4.0.0** - 6/12/2020

   * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
     [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
   * chore: Updated dependencies.

### appcd-nodejs

 * **v4.1.2** - 1/22/2021

   * chore: Updated dependencies.

 * **v4.1.1** - 1/5/2021

   * chore: Updated dependencies.

 * **v4.1.0** - 12/1/2020

   * fix: Bumped minimum Node.js requirement to 10.19.0 to prevent warnings on install.
   * feat: Added HTTP proxy support.
   * chore: Updated dependencies.

 * **v4.0.0** - 6/12/2020

   * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
     [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
   * fix: Cast timestamp to a string when writing the last run file.
   * chore: Updated dependencies.

### appcd-path

 * **v2.0.4** - 1/22/2021

   * chore: Updated dependencies.

 * **v2.0.3** - 1/5/2021

   * chore: Updated dependencies.

 * **v2.0.2** - 12/1/2020

   * chore: Updated dependencies.

 * **v2.0.1** - 6/12/2020

   * chore: Updated dependencies.

 * **v2.0.0** - 5/5/2020

   * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
     [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
   * chore: Updated dependencies.

 * **v1.1.10** - 1/14/2020

   * fix: Fixed bug when resolving the real path of a non-existent top-level directory/file.
     [(DAEMON-310)](https://jira.appcelerator.org/browse/DAEMON-310)

### appcd-plugin

 * **v4.2.4** - 1/22/2021

   * fix: Gracefully handle plugins that fail to auto-start.
   * chore: Updated dependencies.

 * **v4.2.3** - 1/5/2021

   * chore: Updated dependencies.

 * **v4.2.2** - 12/3/2020

   * fix(plugin-base): Fixed extra forward slashes in service paths.

 * **v4.2.1** - 12/3/2020

   * fix(plugin-manager): Only auto-start the latest major version of each plugin.

 * **v4.2.0** - 12/2/2020

   * feat(plugin-base): Added the `dataDir` plugin info and pass it into the plugin on activation.

 * **v4.1.0** - 12/2/2020

   * feat(plugin-base): Added the `autoStarted` flag to plugin info and pass it into the plugin on
     activation.
   * fix(plugin-base): Improved plugin state management if plugin exits during startup.

 * **v4.0.0** - 12/2/2020

   * BREAKING CHANGE: Requires Node.js 10.19.0 or newer.
     [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
   * BREAKING CHANGE: Removed `appcd-request` and is no longer available to plugins.
   * BREAKING CHANGE: Removed `appcd-winreg` and is no longer available to plugins.
     [(DAEMON-277)](https://jira.appcelerator.org/browse/DAEMON-277)
   * feat: Added Plugin API Version to the status.
     [(DAEMON-314)](https://jira.appcelerator.org/browse/DAEMON-314)
   * feat: Added `description`, `homepage`, `license`, `appcdVersion`, `apiVersion`, and `os` from
     the plugin's `package.json` to the plugin info.
   * feat: Added plugin start time to the plugin info.
   * feat(scheme): Added `detect()` method to schemes that resolves a list of plugins found. Also
     managed to clean up a bunch of code and tests in the process.
   * feat: Added symlink flag to plugin descriptor. Used to guess if plugin is a yarn link.
   * feat: Added support for a `autoStart` flag in the plugin's `package.json`.
   * feat: Redact specific sensitive data from plugin debug logging. Redaction is disabled when
     `APPCD_ENV` environment variable is set to `"development"` as is the case when running the Appc
     Daemon's top-level `gulp watch` task.
   * feat: Added `appcd.logger` for plugins to create new namespaced loggers.
   * feat: Added support for plugins to specify their own product app telemetry guid `telemetry.app`
     in their config file. [(DAEMON-299)](https://jira.appcelerator.org/browse/DAEMON-299)
   * feat: Added `appcd.telemetry(evtData)` API for sending plugin scoped telemetry events.
   * feat: Wired up dynamic config updates for internal plugins and the parent process for external
     plugins.
   * feat: Added `appcd.config.get()`, `appcd.config.watch()`, and `appcd.config.unwatch()` so that
     plugins don't have to pass the config object from activate around and call gawk to observe it.
   * feat: `appcd.fs.watch()` within a plugin's context now accepts a numeric debounce value which
     is the period of time to wait before firing the handler.
   * feat: Auto select Node.js version to spawn plugin based on plugin's API version.
   * fix: Fixed bug where `status` would search an unsorted list of registered plugins which caused
     nondeterministic results. [(DAEMON-328)](https://jira.appcelerator.org/browse/DAEMON-328)
   * fix: Fixed bug where an `inactivityTimeout` of zero would be tested as falsey and fallback to
     the default inactivity timeout.
   * fix: Fixed bug where error details were not being passed back when an internal plugin-to-plugin
     call threw an error.
   * fix: Fixed bug where plugin was deactivated before being activated.
   * fix: Initialize plugin `state` in info object to `stopped`.
   * fix(plugin-base): Recursively watch plugin directories for changes.
   * fix(plugin-manager): Check if the plugin config file exists before trying to load it.
   * fix(plugin-manager): When multiple versions of a plugin were registered, the debug log
     incorrectly stated the plugin was unsupported and no message was displayed if the plugin was
     indeed unsupported.
   * fix(plugin-manager): Gracefully handle config file unloading errors.
   * fix(plugin): Gracefully handle plugins that declare a config file that does not exist.
   * fix(tunnel): Removed circular references when sending data through the IPC tunnel.
   * fix(host): Improved logging of uncaught exceptions and rejections.
   * fix(external-plugin): Track non-subscription stream responses so that they can be closed when
     the plugin is stopped.
   * fix(external-plugin): Don't load and track appcd config for parent process, only child process.
   * fix(scheme): Rewrote the scheme filesystem watching system to fix bug where scope directories
     were not being watched for changes and inevitably made scheme detection and watching
     significantly faster and more efficient.
   * refactor(plugin): Code cleanup and moved common code to `PluginBase` to share across internal
     and external plugins.
   * refactor(telemetry): Removed telemetry events when a plugin is added or removed since these
     events can be noisy.
   * chore: Updated dependencies.

### appcd-request

 * **v3.0.0** - 6/12/2020

   * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
     [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
   * chore: Updated dependencies.

### appcd-response

 * **v3.0.3** - 1/22/2021

   * chore: Updated dependencies.

 * **v3.0.2** - 1/5/2021

   * chore: Updated dependencies.

 * **v3.0.1** - 12/1/2020

   * chore: Updated dependencies.

 * **v3.0.0** - 6/12/2020

   * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
     [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
   * chore: Updated dependencies.

### appcd-subprocess

 * **v5.0.2** - 1/22/2021

   * chore: Updated dependencies.

 * **v5.0.1** - 1/5/2021

   * chore: Updated dependencies.

 * **v5.0.0** - 12/1/2020

   * BREAKING CHANGE: Moved `SubprocessManager` to separate `appcd-subprocess-manager` package.
   * fix: Bumped minimum Node.js requirement to 10.19.0 to prevent warnings on install.

 * **v4.0.0** - 6/12/2020

   * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
     [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
   * feat: Added spawn options to `spawnNode()`.
   * chore: Updated dependencies.

### appcd-subprocess-manager

 * **v1.0.2** - 1/22/2021

   * chore: Updated dependencies.

 * **v1.0.1** - 1/5/2021

   * chore: Updated dependencies.

 * **v1.0.0** - 12/1/2020

   * Initial release with `SubprocessManager` migrated from `appcd-subprocess`.
   * feat: Moved subprocess status to top-level route with subscription support.
   * fix: Properly handle IPC send errors when child process goes away.
   * fix: Kill non-detached child processes when response stream is closed by the caller.
   * fix: Decouple subprocess data from `/appcd/status`.
   * fix: Hide child process event emitter so that it won't leak when subprocess info is stringified.

### appcd-telemetry

 * **v5.0.2** - 1/22/2021

   * chore: Updated dependencies.

 * **v5.0.1** - 1/5/2021

   * chore: Updated dependencies.

 * **v5.0.0** - 12/1/2020

   * BREAKING CHANGE: Event names are no longer prefixed with `appcd-`.
   * BREAKING CHANGE: Bumped minimum Node.js requirement to 10.19.0.
   * feat: Scrub potentially sensitive data in telemetry data and error messages.
   * feat: Added ability to set a `hardwareId` instead of relying on the telemetry system to identify
     a machine's unique identifier.
   * feat: Added HTTP proxy support.
   * chore: Updated dependencies.

 * **v4.0.0** - 6/12/2020

   * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
     [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
   * chore: Updated dependencies.

### appcd-util

 * **v3.1.2** - 1/22/2021

   * chore: Updated dependencies.

 * **v3.1.1** - 1/5/2021

   * chore: Updated dependencies.

 * **v3.1.0** - 12/1/2020

   * feat: Added `redact()` function to scrub sensitive information from a value.
   * feat: Added `makeSerializable()` function to remove non-serializable values and circular
     references.
   * feat: Added re-export for Lodash's `set()` function.
   * fix(sha1): Treat buffers like strings and don't JSON.stringify them.

 * **v3.0.0** - 6/12/2020

   * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
     [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
   * chore: Updated dependencies.