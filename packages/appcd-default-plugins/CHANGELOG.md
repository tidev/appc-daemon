# v4.0.0 (Aug 13, 2019)

 * BREAKING CHANGE: `appcd-default-plugins` supports both postinstall and runtime installation of
   default plugins.
 * chore: Updated dependencies

# v3.0.0 (Jun 25, 2019)

 * BREAKING CHANGE: `appcd-default-plugins` no longer includes a "main" JavaScript file so it
   cannot be `require()`'d.
 * BREAKING CHANGE: Plugins are installed into `"~/.appcelerator/appcd/plugins"` instead of the
   `"appcd-default-plugins/plugins"` directory to avoid permission issues when npm installing
   `appcd` globally using `sudo` due to npm dropping root before running the post install script.

   UPDATE: Turns out that this won't work because unless there's an explicit `user` set in the
   npm config, it defaults to the user `nobody` which does not have write permissions to the
   user's home directory.

# v2.0.0 (Jun 6, 2019)

 * feat: Added support for multiple plugin versions.
   [(DAEMON-280)](https://jira.appcelerator.org/browse/DAEMON-280)

# v1.2.0 (Mar 29, 2019)

 * chore: Updated dependencies.

# v1.1.4 (Nov 27, 2018)

 * refactor: Migrated to new `@appcd/` scoped package names.

# v1.1.3 (May 24, 2018)

 * chore: Updated dependencies.

# v1.1.2 (Apr 11, 2018)

 * chore: Updated dependencies.

# v1.1.1 (Apr 9, 2018)

 * feat: Added `appcd-plugin-titanium-sdk` plugin.
   [(DAEMON-217)](https://jira.appcelerator.org/browse/DAEMON-217)
 * refactor: Removed all appcd-* packages which were used as a workaround for a yarn workspaces limitation.
 * chore: Improved readme.

# v1.1.0 (Apr 2, 2018)

 * oops: This was a botched release and has been unpublished.

# v1.0.1 (Dec 15, 2017)

 * chore: Updated dependencies.

# v1.0.0 (Dec 5, 2017)

 - Initial release.
