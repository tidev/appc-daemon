# v2.0.1

 * Removed `getActiveHandles()` call which no longer works in Node.js 11 and switched to
   `trackTimers()` which uses async hooks and works with Node.js 8.1.0 or newer.
   [(DAEMON-268)](https://jira.appcelerator.org/browse/DAEMON-268)

# v2.0.0 (Nov 27, 2018)

 * Bumped minimum Node.js version from 8.0.0 to 8.10.0.
 * Bumped preferred Node.js version from 8.11.1 to 10.13.0.
 * Wired up telemetry for dispatched HTTP and WebSocket requests.
 * Updated telemetry event names:
   - `appcd.server.start` -> `ti.start`
   - `appcd.server.shutdown` -> ti.end`
   - `appcd.server.nodePurge` -> `appcd.server.node_purge`
 * `WebSocketSession` now extends `EventEmitter` and emits a `request` event when a request
   completes.
 * Improved `WebSocketSession` request handling to be more consistent.
 * Added `AMPLIFY_CLI` version to telemetry payload.
   [(DAEMON-263)](https://jira.appcelerator.org/browse/DAEMON-263)
 * Fixed bug where streamed responses only sent `fin` flag for last pubsub event instead of all
   streamed responses. [(DAEMON-266)](https://jira.appcelerator.org/browse/DAEMON-266)
 * Updated dependencies.

# v1.1.3 (May 24, 2018)

 * Removed `process.argv` from telemetry payload for GDPR.
   [(DAEMON-257)](https://jira.appcelerator.org/browse/DAEMON-257)
 * Updated dependencies:
   - appcd-agent 1.1.1 -> 1.1.2
   - appcd-config 1.1.0 -> 1.1.1
   - appcd-config-service 1.1.0 -> 1.1.1
   - appcd-default-plugins 1.1.1 -> 1.1.2
   - appcd-dispatcher 1.1.0 -> 1.1.1
   - appcd-fs 1.1.1 -> 1.1.2
   - appcd-fswatch-manager 1.0.0 -> 1.0.1
   - appcd-fswatcher 1.1.0 -> 1.1.1
   - appcd-gulp 1.1.4 -> 1.1.5
   - appcd-http 1.1.0 -> 1.1.1
   - appcd-logger 1.1.0 -> 1.1.1
   - appcd-nodejs 1.1.0 -> 1.1.1
   - appcd-path 1.1.0 -> 1.1.1
   - appcd-plugin 1.1.0 -> 1.1.2
   - appcd-response 1.1.0 -> 1.1.2
   - appcd-subprocess 1.1.0 -> 1.1.1
   - appcd-telemetry 1.1.0 -> 1.1.1
   - appcd-util 1.1.0 -> 1.1.1

# v1.1.2 (May 17, 2018)

 * Updated dependencies:
   - appcd-gulp 1.1.1 -> 1.1.4
   - cli-kit 0.0.12 -> 0.1.2
   - fs-extra 5.0.0 -> 6.0.1

# v1.1.1 (Apr 11, 2018)

 * Ensure that all WebSocket responses have a status and a (string) statusCode.

# v1.1.0 (Apr 9, 2018)

 * Added support for appcd plugins installed in the global `node_modules` directory.
   [(DAEMON-215)](https://jira.appcelerator.org/browse/DAEMON-215)
 * Fixed bug in logcat service where errors and warnings were being written as objects instead of
   strings which was causing errors to not be rendered properly in the dump file.
   [(DAEMON-219)](https://jira.appcelerator.org/browse/DAEMON-219)
 * Fixed bug with subscription streams not being closed when a socket error occurs from a client
   connection. [(DAEMON-224)](https://jira.appcelerator.org/browse/DAEMON-224)
 * Bumped required version to Node.js 8.11.1 LTS.
 * Fixed core process' health agent to use the poll interval from the config instead of the default.
 * Improved readme.
 * Updated dependencies:
   - accepts 1.3.4 -> 1.3.5
   - appcd-agent 1.0.1 -> 1.1.0
   - appcd-config 1.0.1 -> 1.1.0
   - appcd-config-service 1.0.1 -> 1.1.0
   - appcd-default-plugins 1.0.1 -> 1.1.1
   - appcd-dispatcher 1.0.1 -> 1.1.0
   - appcd-fs 1.0.1 -> 1.1.1
   - appcd-fswatcher 1.0.1 -> 1.1.0
   - appcd-http 1.0.1 -> 1.1.0
   - appcd-gulp 1.0.1 -> 1.1.1
   - appcd-logger 1.0.1 -> 1.1.0
   - appcd-path 1.0.1 -> 1.1.0
   - appcd-plugin 1.0.1 -> 1.1.0
   - appcd-response 1.0.1 -> 1.1.0
   - appcd-subprocess 1.0.1 -> 1.1.0
   - appcd-telemetry 1.0.1 -> 1.1.0
   - appcd-util 1.0.1 -> 1.1.0
   - cli-kit 0.0.9 -> 0.0.12
   - gawk 4.4.4 -> 4.4.5

# v1.0.1 (Dec 15, 2017)

 * Updated dependencies:
   - appcd-agent 1.0.0 -> 1.0.1
   - appcd-config 1.0.0 -> 1.0.1
   - appcd-config-service 1.0.0 -> 1.0.1
   - appcd-default-plugins 1.0.0 -> 1.0.1
   - appcd-dispatcher 1.0.0 -> 1.0.1
   - appcd-fs 1.0.0 -> 1.0.1
   - appcd-fswatcher 1.0.0 -> 1.0.1
   - appcd-gulp 1.0.0 -> 1.0.1
   - appcd-http 1.0.0 -> 1.0.1
   - appcd-logger 1.0.0 -> 1.0.1
   - appcd-path 1.0.0 -> 1.0.1
   - appcd-plugin 1.0.0 -> 1.0.1
   - appcd-response 1.0.0 -> 1.0.1
   - appcd-subprocess 1.0.0 -> 1.0.1
   - appcd-telemetry 1.0.0 -> 1.0.1
   - appcd-util 1.0.0 -> 1.0.1
   - fs-extra 4.0.2 -> 5.0.0

# v1.0.0 (Dec 5, 2017)

 - Initial release.
