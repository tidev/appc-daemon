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
