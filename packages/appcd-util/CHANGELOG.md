# v3.1.6 (Apr 26, 2021)

 * fix(makeSerializable): Only ignore nested duplicates that form circular references instead of
   anything that is a duplicate. [(DAEMON-342)](https://jira.appcelerator.org/browse/DAEMON-342)
 * chore: Updated dependencies.

# v3.1.5 (Apr 15, 2021)

 * fix(redact): Use `os.homedir()` instead of `process.env.HOME` to get users home directory.
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

 * feat: Added `redact()` function to scrub sensitive information from a value.
 * feat: Added `makeSerializable()` function to remove non-serializable values and circular
   references.
 * feat: Added re-export for Lodash's `set()` function.
 * fix(sha1): Treat buffers like strings and don't JSON.stringify them.

# v3.0.0 (Jun 12, 2020)

 * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
   [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
 * chore: Updated dependencies.

# v2.0.2 (Jan 8, 2020)

 * chore: Updated dependencies.

# v2.0.1 (Nov 6, 2019)

 * chore: Fixed homepage and repository URLs in `package.json`.
 * chore: Added links to issue trackers in readme.
 * chore: Updated dependencies.

# v2.0.0 (Aug 13, 2019)

 * BREAKING CHANGE: Bumped minimum supported Node.js version from `>=8.0.0` to `>=8.1.0` to fix
   issue where 8.0.x didn't support `async_hooks.createHook()`, yet `appcd-util` was using it.
 * chore: Updated dependencies

# v1.1.7 (Jun 4, 2019)

 * chore: Updated dependencies.

# v1.1.6 (Mar 29, 2019)

 * chore: Updated dependencies.

# v1.1.5 (Jan 16, 2019)

 * fix: Updated `getActiveHandles()` to gracefully work in the event Node.js deprecates
   `process._getActiveHandles()`.
 * fix: Gracefully handle calls to `process.binding()` should Node.js deprecate it or any of the
   requested bindings.
 * fix: Added `trackTimers()` function in lieu of `getActiveHandles()` no longer being reliable for
   determining active timers in Node.js 11. `trackTimers()` uses async hooks which where added in
   Node.js 8.1.0.
   [(DAEMON-268)](https://jira.appcelerator.org/browse/DAEMON-268)
 * fix: `tailgate()` no longer forces asynchronous execution of the callback using
   `setImmediate()`.
 * refactor: Refactored promises to async/await.
 * chore: Updated dependencies.

# v1.1.4 (Nov 26, 2018)

 * chore: Updated dependencies.

# v1.1.3 (Nov 26, 2018)

 * chore: Updated dependencies.

# v1.1.2 (Sep 17, 2018)

 * feat: Added `osInfo()` function to get operating system name and version.
 * chore: Removed unused variables in tests.
 * chore: Updated dependencies.

# v1.1.1 (May 24, 2018)

 * chore: Updated dependencies.

# v1.1.0 (Apr 9, 2018)

 * feat: Added ability to cancel a pending `debounce()`.
   [(DAEMON-238)](https://jira.appcelerator.org/browse/DAEMON-238)
 * chore: Improved readme.
 * chore: Updated dependencies.

# v1.0.1 (Dec 15, 2017)

 * chore: Updated dependencies.

# v1.0.0 (Dec 5, 2017)

 - Initial release.
