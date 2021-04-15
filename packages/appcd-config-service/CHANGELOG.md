# v3.1.5

 * chore: Updated dependencies.

# v3.1.4 (Mar 3, 2021)

 * chore: Updated dependencies.

# v3.1.3 (Jan 26, 2021)

 * chore: Updated dependencies.

# v3.1.2 (Jan 22, 2021)

 * chore: Updated dependencies.

# v3.1.1 (Jan 5, 2021)

 * chore: Updated dependencies.

# v3.1.0 (Dec 1, 2020)

 * feat: Added config file live reloading.
 * fix: Unload the config layer if the watched config file is deleted.
 * chore: Updated dependencies.

# v3.0.0 (Jun 12, 2020)

 * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
   [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
 * BREAKING CHANGE: Deleting non-existent key returns successfully.
 * BREAKING CHANGE: `set`, `push`, and `unshift` no longer return the current value.
 * refactor: Updated to `appcd-config@3.0.0`, but no major breaking changes as far as the
   `ConfigService` is concerned.
 * chore: Updated dependencies.

# v2.0.3 (Jan 8, 2020)

 * chore: Updated dependencies.

# v2.0.2 (Nov 6, 2019)

 * fix: Fixed bug where `push` and `unshift` actions were not returning the new value.
 * chore: Fixed homepage and repository URLs in `package.json`.
 * chore: Added links to issue trackers in readme.
 * chore: Bumped required Node.js version to 8.12.0 which is technically a breaking change, but
   `appcd-response@2.0.0` already requires Node.js 8.12.0.
 * chore: Updated dependencies.

# v2.0.1 (Aug 13, 2019)

 * chore: Updated dependencies.

# v2.0.0 (Jun 13, 2019)

 * BREAKING CHANGE: Updated to `appcd-dispatche@2.0.0` and `appcd-response@2.0.0`.

# v1.2.3 (Jun 13, 2019)

 * Republish of v1.2.1.

# v1.2.2 (Jun 4, 2019)

 * fix: Removed redundant validation code when loading a config file.
 * feat: Added action handler for unloading a config file.
 * chore: Added more debug logging.
 * chore: Updated dependencies.

# v1.2.1 (Mar 29, 2019)

 * chore: Updated dependencies.

# v1.2.0 (Jan 24, 2019)

 * chore: Upgraded to appcd-logger@2.0.0.

# v1.1.3 (Jan 16, 2019)

 * chore: Updated dependencies.

# v1.1.2 (Nov 27, 2018)

 * fix: Fixed debug logging of undefined filter.
 * chore: Updated dependencies.

# v1.1.1 (May 24, 2018)

 * chore: Updated dependencies.

# v1.1.0 (Apr 9, 2018)

 * fix: Fixed bug in the config service when returning defined, but falsey values.
 * chore: Improved readme.
 * chore: Updated dependencies.

# v1.0.1 (Dec 15, 2017)

 * chore: Updated dependencies.

# v1.0.0 (Dec 5, 2017)

 - Initial release.
