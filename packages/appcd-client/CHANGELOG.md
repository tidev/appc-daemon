# v1.3.3 (Jun 5, 2019)

 * fix: Fixed bad `appcd-response` dependency version.

# v1.3.2 (Jun 4, 2019)

 * chore: Updated dependencies.

# v1.3.1 (Mar 29, 2019)

 * fix: Fixed unhandled exception when attempting to spawn the Appc Daemon.

# v1.3.0 (Mar 29, 2019)

 * feat: Added `startDaemon` flag to `connect()` that will attempt to locate and start the daemon
   if it is not running.
 * chore: Updated dependencies.

# v1.2.0 (Jan 24, 2019)

 * chore: Upgraded to appcd-logger@2.0.0.

# v1.1.3 (Jan 16, 2019)

 * chore: Updated dependencies.

# v1.1.2 (Nov 27, 2018)

 * fix: Fixed handling streamed responses, specifically knowing when the last message has been
   sent. [(DAEMON-266)](https://jira.appcelerator.org/browse/DAEMON-266)
 * chore: Updated dependencies.

# v1.1.1 (May 24, 2018)

 * chore: Updated dependencies.

# v1.1.0 (Apr 9, 2018)

 * chore: Added debug logging that can be viewed by setting `SNOOPLOGG=appcd:client`.
 * feat: Added support for arbitrary properties on error objects to be returned to clients from the
   daemon. [(DAEMON-248)](https://jira.appcelerator.org/browse/DAEMON-248)
 * chore: Improved readme.
 * chore: Minor code clean up.
 * chore: Updated dependencies.

# v1.0.1 (Dec 15, 2017)

 * fix: Only set `Accept-Language` if locale is `null`.
   [(DAEMON-201)](https://jira.appcelerator.org/browse/DAEMON-201)
 * chore: Updated dependencies.

# v1.0.0 (Dec 5, 2017)

 - Initial release.
