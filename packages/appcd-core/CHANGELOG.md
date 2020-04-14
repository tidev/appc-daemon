# v4.0.0

 * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
   [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
 * BREAKING CHANGE: Bumped core Node.js version to 12.16.2. This affects all plugins.
   [(DAEMON-319)](https://jira.appcelerator.org/browse/DAEMON-319)
 * BREAKING CHANGE: Main file exports library instead of the main entry point.
 * feat: Added plugin management functions. This feature has removed the need for
   `appcd-default-plugins` and the associated `plugins.installDefault` config setting.
   [(DAEMON-311)](https://jira.appcelerator.org/browse/DAEMON-311)
 * refactor: Updated to `appcd-config@3.0.0`, created the Appc Daemon config schema, and converted
   the `default.js` config to `default.json`.
 * refactor: Removed Titanium CLI Genymotion config import.
   [(DAEMON-313)](https://jira.appcelerator.org/browse/DAEMON-313)
 * chore: Updated dependencies.

# v3.2.0 (Jan 13, 2020)

 * fix: Fixed `--config` and `--config-file` format to require a value.
 * fix: Await `PluginManager` to initialize.
   [(DAEMON-308)](https://jira.appcelerator.org/browse/DAEMON-308)
 * fix: Removed `status` and `statusCode` from subsequent non-pubsub chunked responses.
 * chore: Updated dependencies.

# v3.1.0 (Nov 6, 2019)

 * feat: Added `plugins.installDefault` config setting (default `true`) to control whether the
   default plugins should be installed on appcd start.
 * feat: Added `server.persistDebugLog` config setting (default `false`) to persist debug log to
   disk. [(DAEMON-93)](https://jira.appcelerator.org/browse/DAEMON-93)
 * fix: Fixed bug with order of loading an arbitrary `--config-file` and the user-defined config
   file.
 * chore: Updated Node.js version from 10.16.2 to 10.16.3.
 * chore: Fixed homepage and repository URLs in `package.json`.
 * chore: Added links to issue trackers in readme.
 * chore: Updated dependencies

# v3.0.0 (Aug 13, 2019)

 * BREAKING CHANGE: Updated to `appcd-default-plugins@4.0.0`, `appcd-nodejs@3.0.0`,
   `appcd-plugin@3.0.0`, `appcd-subprocess@3.0.0`, `appcd-telemetry@3.0.0`, and `appcd-util@2.0.0`.
 * fix: Added `sid` to WebSocketSession context so remote clients will know the subscription id.
 * fix: Fixed bug where `server.hostname` was not being correctly referenced.
 * chore: Bumped Node.js version from 10.15.3 to 10.16.2.
 * chore: Updated configuration setting descriptions and metadata.
 * chore: Updated dependencies

# v2.8.0 (Jun 25, 2019)

 * chore: Updated to `appcd-default-plugins@3.0.0`.

# v2.7.0 (Jun 24, 2019)

 * chore: Updated to `appcd-config-service@2.0.0`.

# v2.6.0 (Jun 13, 2019)

 * chore: Updated to `appcd-config-service@1.2.3`, `appcd-dispatcher@2.0.0`,
   `appcd-fswatch-manager@2.0.0`, `appcd-nodejs@2.0.0`, `appcd-plugin@2.1.0`,
   `appcd-subprocess@2.0.1`, and `appcd-telemetry@2.0.1`.

# v2.5.0 (Jun 6, 2019)

 * chore: Updated to `appcd-plugin@2.0.0` and `appcd-telemetry@2.0.0`.
 * chore: Updated to `appcd-default-plugins@2.0.0`.

# v2.4.0 (Jun 6, 2019)

 * Unpublished Jun 10, 2019.

# v2.3.0 (Jun 4, 2019)

 * BREAKING CHANGE: Bumped minimum required Node.js version from v8.10.0 to v8.12.0.
 * refactor: Refactored shutdown handler to use async/await.
 * chore: Updated telemetry config settings to latest endpoint.
 * chore: Updated dependencies.

# v2.2.0 (Mar 29, 2019)

 * chore: Bumped Node.js version from 8.15.0 to 10.15.3.
 * chore: Updated dependencies.

# v2.1.0 (Jan 24, 2019)

 * chore: Upgraded to appcd-logger@2.0.0.

# v2.0.1 (Jan 16, 2019)

 * fix: Removed `getActiveHandles()` call which no longer works in Node.js 11 and switched to
   `trackTimers()` which uses async hooks and works with Node.js 8.1.0 or newer.
   [(DAEMON-268)](https://jira.appcelerator.org/browse/DAEMON-268)
 * fix: Added humanize dependency since it was removed from snooplogg 2.
 * refactor: Refactored promises to async/await.
 * chore: Bumped Node.js version from 8.13.0 to 10.15.0.
 * chore: Updated dependencies.


# v2.0.0 (Nov 27, 2018)

 * BREAKING CHANGE: Bumped minimum Node.js version from 8.0.0 to 8.10.0.
 * chore: Bumped preferred Node.js version from 8.11.1 to 10.13.0.
 * feat: Wired up telemetry for dispatched HTTP and WebSocket requests.
 * fix: Updated telemetry event names:
   - `appcd.server.start` -> `ti.start`
   - `appcd.server.shutdown` -> ti.end`
   - `appcd.server.nodePurge` -> `appcd.server.node_purge`
 * feat: `WebSocketSession` now extends `EventEmitter` and emits a `request` event when a request
   completes.
 * fix: Improved `WebSocketSession` request handling to be more consistent.
 * feat: Added `AMPLIFY_CLI` version to telemetry payload.
   [(DAEMON-263)](https://jira.appcelerator.org/browse/DAEMON-263)
 * fix: Fixed bug where streamed responses only sent `fin` flag for last pubsub event instead of
   all streamed responses. [(DAEMON-266)](https://jira.appcelerator.org/browse/DAEMON-266)
 * chore: Updated dependencies.

# v1.1.3 (May 24, 2018)

 * fix: Removed `process.argv` from telemetry payload for GDPR.
   [(DAEMON-257)](https://jira.appcelerator.org/browse/DAEMON-257)
 * chore: Updated dependencies.

# v1.1.2 (May 17, 2018)

 * chore: Updated dependencies.

# v1.1.1 (Apr 11, 2018)

 * fix: Ensure that all WebSocket responses have a status and a (string) statusCode.

# v1.1.0 (Apr 9, 2018)

 * feat: Added support for appcd plugins installed in the global `node_modules` directory.
   [(DAEMON-215)](https://jira.appcelerator.org/browse/DAEMON-215)
 * fix: Fixed bug in logcat service where errors and warnings were being written as objects instead
   of strings which was causing errors to not be rendered properly in the dump file.
   [(DAEMON-219)](https://jira.appcelerator.org/browse/DAEMON-219)
 * fix: Fixed bug with subscription streams not being closed when a socket error occurs from a
   client connection. [(DAEMON-224)](https://jira.appcelerator.org/browse/DAEMON-224)
 * chore: Bumped required version to Node.js 8.11.1 LTS.
 * fix: Fixed core process' health agent to use the poll interval from the config instead of the
   default.
 * chore: Improved readme.
 * chore: Updated dependencies.

# v1.0.1 (Dec 15, 2017)

 * chore: Updated dependencies.

# v1.0.0 (Dec 5, 2017)

 - Initial release.
