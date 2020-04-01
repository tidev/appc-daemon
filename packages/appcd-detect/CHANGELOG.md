# v3.0.0

 * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
   [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
 * chore: Updated dependencies.

# v2.2.3 (Jan 10, 2020)

 * fix: Only use a single recursive file watcher instead of watching each found path when recursive
   and redetect flags are set.

# v2.2.2 (Jan 8, 2020)

 * chore: Updated dependencies.

# v2.2.1 (Nov 6, 2019)

 * chore: Fixed homepage and repository URLs in `package.json`.
 * chore: Added links to issue trackers in readme.
 * chore: Updated dependencies.

# v2.2.0 (Aug 13, 2019)

 * feat: Updated `registryKeys` option for more advanced Windows Registry handling.
 * chore: Updated dependencies.

# v2.1.0 (Jun 13, 2019)

 * chore: Updated to `appcd-dispatcher@2.0.0`, `appcd-fswatch-manager@2.0.0`, and
   `appcd-subprocess@2.0.1`.

# v2.0.0 (Jun 10, 2019)

 * BREAKING CHANGE: Bumped minimum required Node.js version from v8.0.0 to v8.12.0.
 * misc: Added more debug logging around the default path determination.
 * feat: Replaced `appcd-winreg` with `winreglib`.
   [(DAEMON-276)](https://jira.appcelerator.org/browse/DAEMON-276)
 * chore: Updated dependencies.

# v1.3.0 (Mar 29, 2019)

 * fix: Added `paths` property to dynamically change the paths to scan and kicks off a rescan.
 * chore: Updated dependencies.

# v1.2.0 (Jan 24, 2019)

 * chore: Upgraded to appcd-logger@2.0.0.

# v1.1.3 (Jan 16, 2019)

 * fix: Added pluralize dependency since it was removed from snooplogg 2.
 * refactor: Refactored promises to async/await.
 * chore: Updated dependencies.

# v1.1.2 (Nov 27, 2018)

 * chore: Updated dependencies.

# v1.1.1 (May 24, 2018)

 * chore: Updated dependencies.

# v1.1.0 (Apr 9, 2018)

 * fix: Fixed typo that caused a problem when the detect engine started scanning subdirectories.
 * chore: Improved readme.
 * chore: Updated dependencies.

# v1.0.1 (Dec 15, 2017)

 * chore: Updated dependencies.

# v1.0.0 (Dec 5, 2017)

 - Initial release.
