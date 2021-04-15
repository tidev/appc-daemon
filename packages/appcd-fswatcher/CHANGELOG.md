# v2.0.6

 * chore: Updated dependencies.

# v2.0.5 (Mar 3, 2021)

 * chore: Updated dependencies.

# v2.0.4 (Jan 26, 2021)

 * chore: Updated dependencies.

# v2.0.3 (Jan 22, 2021)

 * chore: Updated dependencies.

# v2.0.2 (Jan 5, 2021)

 * chore: Updated dependencies.

# v2.0.1 (Dec 1, 2020)

 * fix: Fixed bug when recursively watching with a depth a non-existent directory that is created
   with subdirectories where the depths were being reset when the node is reinitialized.
 * fix: Fixed bug where notification depth counter was off by 1 when emitting the 'add' event for a
   new subdirectory to parent nodes.
 * chore: Updated dependencies.

# v2.0.0 (Jun 12, 2020)

 * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
   [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
 * chore: Updated dependencies.

# v1.2.5 (Jan 8, 2020)

 * chore: Updated dependencies.

# v1.2.4 (Nov 6, 2019)

 * chore: Fixed homepage and repository URLs in `package.json`.
 * chore: Added links to issue trackers in readme.
 * chore: Bumped required Node.js version to 8.1.0 which is technically a breaking change, but
   `appcd-util@2.0.0` already requires Node.js 8.1.0.
 * chore: Updated dependencies.

# v1.2.3 (Aug 13, 2019)

 * chore: Updated dependencies.

# v1.2.2 (Jun 4, 2019)

 * chore: Updated dependencies.

# v1.2.1 (Mar 29, 2019)

 * chore: Updated dependencies.

# v1.2.0 (Jan 24, 2019)

 * chore: Upgraded to appcd-logger@2.0.0.

# v1.1.3 (Jan 16, 2019)

 * fix: Fixed bug where directories becoming unrestricted were not sending correct "add"
   notifications for child files and directories.
 * fix: Added pluralize dependency since it was removed from snooplogg 2.
 * chore: Updated dependencies.

# v1.1.2 (Nov 27, 2018)

 * chore: Updated dependencies.

# v1.1.1 (May 24, 2018)

 * chore: Updated dependencies.

# v1.1.0 (Apr 9, 2018)

 * feat: Added support for handling restricted directories and files.
   [(DAEMON-233)](https://jira.appcelerator.org/browse/DAEMON-233)
   [(DAEMON-232)](https://jira.appcelerator.org/browse/DAEMON-232)
 * fix: Fixed recursively watching created or unwatch deleted directories/files.
   [(DAEMON-235)](https://jira.appcelerator.org/browse/DAEMON-235)
 * refactor: Moved the `FSWatchManager` to
   [`appcd-fswatch-manager`](https://npmjs.org/package/appcd-fswatch-manager) package.
 * chore: Improved readme.
 * chore: Updated dependencies.

# v1.0.1 (Dec 15, 2017)

 * chore: Updated dependencies.

# v1.0.0 (Dec 5, 2017)

 - Initial release.
