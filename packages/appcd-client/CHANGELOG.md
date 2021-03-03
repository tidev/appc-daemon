# v3.0.5 (Mar 3, 2021)

 * chore: Updated dependencies.

# v3.0.4 (Jan 26, 2021)

 * chore: Updated dependencies.

# v3.0.3 (Jan 22, 2021)

 * chore: Updated dependencies.

# v3.0.2 (Jan 5, 2021)

 * chore: Updated dependencies.

# v3.0.1 (Dec 1, 2020)

 * fix: Replaced AMPLIFY CLI references with Axway CLI.
 * chore: Updated dependencies.

# v3.0.0 (Jun 12, 2020)

 * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
   [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
 * feat: Added `startDaemon` flag to `request()` method which passes it through to `connect()`.
 * chore: Updated dependencies.

# v2.0.4 (Jan 13, 2020)

 * fix: Fixed bug where chunked responses that didn't contain a status were treated as 500 errors
   and the client would disconnect.
 * chore: Updated dependencies.

# v2.0.3 (Jan 8, 2020)

 * chore: Updated dependencies.

# v2.0.2 (Nov 6, 2019)

 * fix: Fixed auto user agent generation for Node's repl.
 * chore: Fixed homepage and repository URLs in `package.json`.
 * chore: Added links to issue trackers in readme.
 * chore: Bumped required Node.js version to 8.12.0 which is technically a breaking change, but
   `appcd-response@2.0.0` already requires Node.js 8.12.0.
 * chore: Updated dependencies

# v2.0.1 (Aug 13, 2019)

 * chore: Updated dependencies

# v2.0.0 (Jun 13, 2019)

 * BREAKING CHANGE: Updated to `appcd-response@2.0.0`.

# v1.3.4 (Jun 13, 2019)

 * Republish of v1.3.1.

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
