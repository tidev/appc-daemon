# v4.0.3

 * chore: Updated dependencies.

# v4.0.2 (Mar 3, 2021)

 * fix(status): Use the `version` for the appcd core version if `coreVersion` is undefined as is
   the case in appcd 3.2.0 and older.
 * chore: Updated dependencies.

# v4.0.1 (Jan 26, 2021)

 * fix(status): Fixed bug rendering the plugin API version.
 * chore: Updated dependencies.

# v4.0.0 (Jan 22, 2021)

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

# v3.2.0 (Jan 13, 2020)

 * fix: Fixed `--config` and `--config-file` format to require a value.
 * chore: Updated dependencies.

# v3.1.0 (Nov 6, 2019)

 * fix(common): Fixed bug with order of loading an arbitrary `--config-file` and the user-defined
   config file.
 * fix(common): Fixed bug where the incorrect global package directory was being resolved based on
   the Node.js executable used to spawn the core instead of the Node.js version used to run the
   `appcd` command.
 * fix(common): Re-enable detaching the core when starting the daemon to prevent unintended SIGINT
   propagation. [(DAEMON-288)](https://jira.appcelerator.org/browse/DAEMON-288)
 * fix(config): Fixed config 'delete' aliases when daemon is not running.
 * chore: Fixed homepage and repository URLs in `package.json`.
 * chore: Added links to issue trackers in readme.
 * chore: Updated dependencies.

# v3.0.0 (Aug 13, 2019)

 * chore: Fixed eslint `hasOwnProperty` warnings.
 * chore: Updated dependencies

# v2.7.0 (Jun 24, 2019)

 * chore: Updated to `appcd-core@2.8.0` which updated to `appcd-default-plugins@3.0.0`.

# v2.6.0 (Jun 24, 2019)

 * fix(config): Fixed bug where bad `config` command would not disconnect from daemon.
 * chore: Updated to `appcd-core@2.7.0`.

# v2.5.0 (Jun 13, 2019)

 * chore: Updated to `appcd-client@2.0.0`, `appcd-core@2.6.0`, and `appcd-nodejs@2.0.0`.

# v2.4.0 (Jun 6, 2019)

 * chore: Updated to `appcd-core@2.4.0` which updated to `appcd-default-plugins@2.0.0`.

# v2.3.0 (Jun 4, 2019)

 * BREAKING CHANGE: Bumped minimum required Node.js version from v8.10.0 to v8.12.0.
 * fix: Changed `--debug` flag for `start` and `restart` commands so that it no longer starts the
   Node.js debugger.
 * feat: Added `--debug-inspect` flag to the `start` and `restart` commands that connects the
   Node.js debugger.
 * fix: Changed the Node.js debugger port to the default port of `9229`.
 * fix: Fixed config list to show empty arrays.
 * fix: Fixed SIGINT and SIGTERM signal handlers when debugging.
 * chore: Updated dependencies.

# v2.2.0 (Mar 29, 2019)

 * fix: Fixed bug where the appcd client would exit when the connection to the server closed.
 * refactor: Updated internal `stopServer()` function to async/await.
 * chore: Updated dependencies.

# v2.1.0 (Jan 24, 2019)

 * chore: Upgraded to appcd-logger@2.0.0.

# v2.0.1 (Jan 16, 2019)

 * fix(config): Actions were not being translated correctly when dispatching request to daemon
   config service.
   [(DAEMON-269)](https://jira.appcelerator.org/browse/DAEMON-269)
 * fix: Added humanize dependency since it was removed from snooplogg 2.
 * refactor: Refactored promises to async/await.
 * chore: Updated dependencies.

# v2.0.0 (Nov 27, 2018)

 * feat: Added `v8-compile-cache` to noticeably speed up execute.
 * chore: Updated to latest `cli-kit`:
   - Enable `appcd` to be a proper `cli-kit` extension.
   - Added banner
   - Removed `--no-colors` since `cli-kit` now handles this for us.
 * fix: Updated all commands to import dependencies in their action handlers instead of the top of the
   file yielding in an approximately 30% speed bump.
 * refactor: Moved all commands into a `commands` subdirectory.
 * fix: Fixed extra `}` in user agent.
 * fix: Fixed `appcd config ls` (and `list`) actions.
 * fix: Removed unnecessary subscribe logic when rendering `exec` command responses.
   [(DAEMON-266)](https://jira.appcelerator.org/browse/DAEMON-266)
 * chore: Updated dependencies.

# v1.1.3 (May 24, 2018)

 * chore: Updated dependencies.

# v1.1.2 (May 17, 2018)

 * feat: Exported the CLI definition so that `appcd` can extend `cli-kit` enabled CLI's.
   [(DAEMON-256)](https://jira.appcelerator.org/browse/DAEMON-256)
 * chore: Updated dependencies.

# v1.1.1 (Apr 10, 2018)

 * fix: Changed `exec` command to return full JSON response instead of just the message.

# v1.1.0 (Apr 9, 2018)

 * feat: Added `--view` option to `appcd dump` command which launches the dump in the
   [appcd-dump-viewer](https://github.com/appcelerator/appcd-dump-viewer).
   [(DAEMON-183)](https://jira.appcelerator.org/browse/DAEMON-183)
 * fix: Removed potentially sensitive information (hostname, environment variables) from dump file.
 * fix: Fixed order of plugins in `appcd status` output.
   [(DAEMON-216)](https://jira.appcelerator.org/browse/DAEMON-216)
 * fix: Changed `appcd exec` to return errors as stringified objects.
   [(DAEMON-248)](https://jira.appcelerator.org/browse/DAEMON-248)
 * chore: Cleaned up readme.
 * chore: Updated dependencies.

# v1.0.1 (Dec 15, 2017)

 * fix: Fixed bug where restarting the daemon didn't wait for it to gracefully shutdown.
   [(DAEMON-207)](https://jira.appcelerator.org/browse/DAEMON-207)
 * chore: Updated dependencies.

# v1.0.0 (Dec 5, 2017)

 - Initial release.
