# Appc Daemon 4.0.0

## Unreleased

This is a major release with breaking changes, new features, bug fixes, and dependency updates.

### Installation

```
npm i -g appcd@4.0.0
```

### appcd@4.0.0

 * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
   [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
 * BREAKING CHANGE(config): `config` command no longer returns status as apart of JSON output.
 * BREAKING CHANGE(config): `config` command does not return current value when doing a `set`,
   `push`, or `unshift`.
 * BREAKING CHANGE(config): `config list` command no longer supports filtering, use `config get`
   instead.
 * BREAKING CHANGE(config): Write operations such as `set` return `"OK"` instead of `"Saved"`.
 * feat(status): Added Plugin API Version to the status output.
   [(DAEMON-314)](https://jira.appcelerator.org/browse/DAEMON-314)
 * feat: Added `pm` command for managing appcd plugins.
   [(DAEMON-311)](https://jira.appcelerator.org/browse/DAEMON-311)
 * feat: Added additional documentation and examples to the help output for some commands.
 * feat: Show aliases in help for commands such as `config` and `pm`.
 * feat(status): Added new "Health" section to status output.
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
 * chore: Updated dependencies.

### appcd-agent@2.0.0

 * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
   [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
 * chore: Updated dependencies.

### appcd-client@3.0.0

 * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
   [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
 * feat: Added `startDaemon` flag to `request()` method which passes it through to `connect()`.
 * chore: Updated dependencies.

### appcd-client@3.0.1

 * chore: Updated dependencies.

### appcd-config@3.0.0

 * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
   [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
 * BREAKING CHANGE: `appcd-config` is no longer a general purpose config management system. It is
   solely intended to be used internally by the Appc Daemon. Packages dependent on `appcd-config`
   should migrate to `cfg-kit`.
 * BREAKING CHANGE: Metadata has been removed.
 * BREAKING CHANGE: `save()` is no longer asynchronous and thus does not return a promise.
 * chore: Updated dependencies.

### appcd-config@3.0.1

 * chore: Updated dependencies.

### appcd-config-service@3.0.0

 * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
   [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
 * BREAKING CHANGE: Deleting non-existent key returns successfully.
 * BREAKING CHANGE: `set`, `push`, and `unshift` no longer return the current value.
 * refactor: Updated to `appcd-config@3.0.0`, but no major breaking changes as far as the
   `ConfigService` is concerned.
 * chore: Updated dependencies.

### appcd-config-service@3.1.0

 * feat: Added config file live reloading.

### appcd-core@4.0.0

 * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
   [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
 * BREAKING CHANGE: Bumped core Node.js version to 12.18.2. This affects all plugins.
   [(DAEMON-319)](https://jira.appcelerator.org/browse/DAEMON-319)
 * BREAKING CHANGE: Main file exports library instead of the main entry point.
 * BREAKING CHANGE(status-monitor): Daemon uptime has changed from seconds to milliseconds.
 * feat: Added plugin management functions. This feature has removed the need for
   `appcd-default-plugins` and the associated `plugins.installDefault` config setting.
   [(DAEMON-311)](https://jira.appcelerator.org/browse/DAEMON-311)
 * feat(server): Stop config service when daemon is gracefully shutdown.
 * feat(server): Added import for `android.buildTools.selectedVersion` Titanium config setting.
 * refactor: Updated to `appcd-config@3.0.0`, created the Appc Daemon config schema, and converted
   the `default.js` config to `default.json`.
 * refactor: Removed Titanium CLI Genymotion config import.
   [(DAEMON-313)](https://jira.appcelerator.org/browse/DAEMON-313)
 * fix(websocket-session): Removed `message` from response if `undefined` so that msgpack cannot
   convert it to `null`.
 * fix: Cast the process id to a string when writing the pid file.
 * fix(status-monitor): Fixed bug where status was reporting incorrect uptime in debug log.
 * chore: Updated dependencies.

### appcd-default-plugins@4.2.1

 * fix: Explicitly update PATH environment variable so that it is properly inherited by the child
   process on Windows. [(DAEMON-330)](https://jira.appcelerator.org/browse/DAEMON-330)
 * fix: Create missing `lerna.cmd` and `yarn.cmd` scripts needed for Windows.
   [(DAEMON-332)](https://jira.appcelerator.org/browse/DAEMON-332)
 * chore: Updated dependencies.

### appcd-detect@3.0.0

 * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
   [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
 * chore: Updated dependencies.

### appcd-dispatcher@3.0.0

 * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
   [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
 * chore: Updated dependencies.

### appcd-dispatcher@3.1.0

 * feat: Default `DispatcherContext` response as a `PassThrough` stream.
 * chore: Updated dependencies.

### appcd-fs@2.0.0

 * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
   [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
 * chore: Updated dependencies.

### appcd-fswatch-manager@3.0.0

 * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
   [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
 * chore: Updated dependencies.

### appcd-fswatcher@2.0.0

 * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
   [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
 * chore: Updated dependencies.

### appcd-gulp@2.4.0

 * feat: Added optional chaining Babel plugin.
 * chore: Updated dependencies.

### appcd-gulp@3.0.0

 * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
   [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
 * chore: Updated dependencies.

### appcd-gulp@3.0.1

 * chore: Updated dependencies.

### appcd-gulp@3.1.0

 * feat: Added Babel config for Node 14.
 * chore: Updated dependencies.

### appcd-http@2.0.0

 * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
   [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
 * chore: Updated dependencies.

### appcd-http@2.0.1

 * chore: Updated dependencies.

### appcd-logger@3.0.0

 * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
   [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
 * chore: Updated dependencies.

### appcd-machine-id@4.0.0

 * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
   [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
 * chore: Updated dependencies.

### appcd-nodejs@4.0.0

 * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
   [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
 * fix: Cast timestamp to a string when writing the last run file.
 * chore: Updated dependencies.

### appcd-nodejs@4.0.1

 * chore: Updated dependencies.

### appcd-path@1.1.10

 * fix: Fixed bug when resolving the real path of a non-existent top-level directory/file.
   [(DAEMON-310)](https://jira.appcelerator.org/browse/DAEMON-310)

### appcd-path@2.0.0

 * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
   [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
 * chore: Updated dependencies.

### appcd-path@2.0.1

 * chore: Updated dependencies.

### appcd-plugin@4.0.0

 * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
   [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
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
 * refactor(plugin): Code cleanup and moved common code to `PluginBase` to share across internal
   and external plugins.
 * chore: Updated dependencies.

### appcd-request@3.0.0

 * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
   [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
 * chore: Updated dependencies.

### appcd-response@3.0.0

 * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
   [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
 * chore: Updated dependencies.

### appcd-subprocess@4.0.0

 * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
   [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
 * feat: Added spawn options to `spawnNode()`.
 * chore: Updated dependencies.

### appcd-subprocess@4.0.1

 * fix: Properly handle IPC send errors when child process goes away.

### appcd-telemetry@4.0.0

 * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
   [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
 * chore: Updated dependencies.

### appcd-telemetry@5.0.0

 * BREAKING CHANGE: Event names are no longer prefixed with `appcd-`.
 * feat: Scrub potentially sensitive data in telemetry data and error messages.
 * chore: Updated dependencies.

### appcd-util@3.0.0

 * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
   [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
 * chore: Updated dependencies.

### appcd-util@3.1.0

 * feat: Added `redact()` function to scrub sensitive information from a value.
 * feat: Added re-export for Lodash's `set()` function.