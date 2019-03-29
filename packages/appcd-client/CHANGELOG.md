# v1.3.1 (Mar 29, 2019)

 * Fixed unhandled exception when attempting to spawn the Appc Daemon.

# v1.3.0 (Mar 29, 2019)

 * Added `startDaemon` flag to `connect()` that will attempt to locate and start the daemon if it
   is not running.
 * Updated dependencies.

# v1.2.0 (Jan 24, 2019)

 * Upgraded to appcd-logger@2.0.0.

# v1.1.3 (Jan 16, 2019)

 * Updated dependencies.

# v1.1.2 (Nov 27, 2018)

 * Fixed handling streamed responses, specifically knowing when the last message has been sent.
   [(DAEMON-266)](https://jira.appcelerator.org/browse/DAEMON-266)
 * Updated dependencies.

# v1.1.1 (May 24, 2018)

 * Updated dependencies:
   - appcd-gulp 1.1.1 -> 1.1.5
   - appcd-logger 1.1.0 -> 1.1.1
   - appcd-response 1.1.0 -> 1.1.2
   - appcd-util 1.1.0 -> 1.1.1
   - source-map-support 0.5.4 -> 0.5.6
   - ws 5.1.0 -> 5.2.0

# v1.1.0 (Apr 9, 2018)

 * Added debug logging that can be viewed by setting `SNOOPLOGG=appcd:client`.
 * Added support for arbitrary properties on error objects to be returned to clients from the
   daemon.
   [(DAEMON-248)](https://jira.appcelerator.org/browse/DAEMON-248)
 * Improved readme.
 * Minor code clean up.
 * Updated dependencies:
   - appcd-gulp 1.0.1 -> 1.1.1
   - appcd-response 1.0.1 -> 1.1.0
   - appcd-util 1.0.1 -> 1.1.0
   - source-map-support 0.5.0 -> 0.5.4
   - uuid 3.1.0 -> 3.2.1
   - ws 3.3.2 -> 5.1.0

# v1.0.1 (Dec 15, 2017)

 * Only set `Accept-Language` if locale is `null`.
   [(DAEMON-201)](https://jira.appcelerator.org/browse/DAEMON-201)
 * Updated dependencies:
   - appcd-gulp 1.0.0 -> 1.0.1
   - appcd-response 1.0.0 -> 1.0.1
   - appcd-util 1.0.0 -> 1.0.1

# v1.0.0 (Dec 5, 2017)

 - Initial release.
