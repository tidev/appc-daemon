# v2.0.1

 * chore: Updated dependencies.

# v2.0.0 (Nov 6, 2019)

 * BREAKING CHANGE: Removed `load()` helper as it was too Appc Daemon specific.
 * BREAKING CHANGE: Renamed `Root` namespace to `Base`.
 * BREAKING CHANGE: Removed `isUserDefined` option from `load()`.
 * feat: Added `baseConfig` and `baseConfigFile` to load configuration into the `Base` namespace.
 * feat: Added new `skipIfNotExists` option to `load()`.
 * feat: Added support for handlebars style variables in string values that resolve other config
   values.
 * fix: Added new `Runtime` layer to allow config settings set at runtime to override `Base` and
   `User` config values.
 * fix: Apply the runtime config after a file is loaded into the runtime namespace.
 * fix: Fixed bug introduced with config layer feature that wasn't allowing readonly values to be
   overwritten during initial load.
 * fix: Array merging, push, and unshifting no longer allows duplicate values.
 * chore: Fixed homepage and repository URLs in `package.json`.
 * chore: Added links to issue trackers in readme.
 * chore: Updated dependencies

# v1.3.1 (Aug 13, 2019)

 * fix: Fixed bug when pushing a config value to an existing key with null value.
 * chore: Fixed eslint `hasOwnProperty` warnings.
 * chore: Updated dependencies.

# v1.3.0 (Jun 4, 2019)

 * refactor: Complete refactor to support config namespaces.
   [(DAEMON-274)](https://jira.appcelerator.org/browse/DAEMON-274)
 * chore: Updated dependencies.

# v1.2.1 (Mar 29, 2019)

 * chore: Updated dependencies.

# v1.2.0 (Jan 24, 2019)

 * chore: Upgraded to appcd-logger@2.0.0.

# v1.1.4 (Jan 16, 2019)

 * chore: Updated dependencies.

# v1.1.3 (Nov 27, 2018)

 * chore: Updated dependencies.
 * refactor: Moved from babylon to @babel/parser

# v1.1.2 (Sep 17, 2018)

 * chore: Updated dependencies.

# v1.1.1 (May 24, 2018)

 * chore: Updated dependencies.

# v1.1.0 (Apr 9, 2018)

 * chore: Improved readme.
 * chore: Updated dependencies.

# v1.0.1 (Dec 15, 2017)

 * chore: Updated dependencies.

# v1.0.0 (Dec 5, 2017)

 - Initial release.
