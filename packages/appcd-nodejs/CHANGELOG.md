# v2.0.1 (Jun 13, 2019)

 * chore: Updated to `appcd-nodejs@2.0.0`.

# v2.0.0 (Jun 13, 2019)

 * BREAKING CHANGE: Updated to `appcd-request@2.0.0`.

# v1.2.2 (Jun 4, 2019)

 * fix: Removed dependency on `tmp` package so that its SIGINT handler doesn't force exit the
   program.
 * chore: Updated dependencies.

# v1.2.1 (Mar 29, 2019)

 * chore: Updated dependencies.

# v1.2.0 (Jan 24, 2019)

 * chore: Upgraded to appcd-logger@2.0.0.

# v1.1.4 (Jan 16, 2019)

 * fix: Added pluralize dependency since it was removed from snooplogg 2.
 * refactor: Refactored promises to async/await.
 * chore: Updated dependencies.

# v1.1.3 (Nov 27, 2018)

 * chore: Updated dependencies.

# v1.1.2 (Sep 17, 2018)

 * chore: Updated dependencies.

# v1.1.1 (May 24, 2018)

 * chore: Updated dependencies.

# v1.1.0 (Apr 9, 2018)

 * feat: Added support for purging Node.js executables that haven't been used for more than 90
   days. [(DAEMON-244)](https://jira.appcelerator.org/browse/DAEMON-244)
 * refactor: Moved `APPCD_NETWORK_CA_FILE`, `APPCD_NETWORK_PROXY`, and `APPCD_NETWORK_STRICT_SSL`
   environment variables to [`appcd-request`](https://npmjs.org/package/appcd-request).
 * chore: Improved readme.
 * chore: Updated dependencies.

# v1.0.1 (Dec 15, 2017)

 * chore: Updated dependencies.

# v1.0.0 (Dec 5, 2017)

 - Initial release.
