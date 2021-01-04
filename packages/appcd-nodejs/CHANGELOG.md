# v4.1.1

 * chore: Updated dependencies.

# v4.1.0 (Dec 1, 2020)

 * fix: Bumped minimum Node.js requirement to 10.19.0 to prevent warnings on install.
 * feat: Added HTTP proxy support.
 * chore: Updated dependencies.

# v4.0.0 (Jun 12, 2020)

 * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
   [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
 * fix: Cast timestamp to a string when writing the last run file.
 * chore: Updated dependencies.

# v3.0.2 (Jan 8, 2020)

 * chore: Updated dependencies.

# v3.0.1 (Nov 6, 2019)

 * fix: Discontinue automatic unref of detached subprocesses.
 * chore: Fixed homepage and repository URLs in `package.json`.
 * chore: Added links to issue trackers in readme.
 * chore: Bumped required Node.js version to 8.12.0 which is technically a breaking change, but
   `appcd-request@2.0.0` already requires Node.js 8.12.0.
 * chore: Updated dependencies.

# v3.0.0 (Aug 13, 2019)

 * BREAKING CHANGE: Updated to `appcd-util@2.0.0`.
 * chore: Updated dependencies.

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
