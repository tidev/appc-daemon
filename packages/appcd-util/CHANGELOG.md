# v1.1.6 (Mar 29, 2019)

 * Updated dependencies.

# v1.1.5 (Jan 16, 2019)

 * Updated `getActiveHandles()` to gracefully work in the event Node.js deprecates
   `process._getActiveHandles()`.
 * Gracefully handle calls to `process.binding()` should Node.js deprecate it or any of the
   requested bindings.
 * Added `trackTimers()` function in lieu of `getActiveHandles()` no longer being reliable for
   determining active timers in Node.js 11. `trackTimers()` uses async hooks which where added in
   Node.js 8.1.0.
   [(DAEMON-268)](https://jira.appcelerator.org/browse/DAEMON-268)
 * `tailgate()` no longer forces asynchronous execution of the callback using `setImmediate()`.
 * Refactored promises to async/await.
 * Updated dependencies.

# v1.1.4 (Nov 26, 2018)

 * Updated dependencies.

# v1.1.3 (Nov 26, 2018)

 * Updated dependencies.

# v1.1.2 (Sep 17, 2018)

 * Added `osInfo()` function to get operating system name and version.
 * Removed unused variables in tests.
 * Updated dependencies.

# v1.1.1 (May 24, 2018)

 * Updated dependencies:
   - appcd-fs 1.1.1 -> 1.1.2
   - appcd-gulp 1.1.1 -> 1.1.5
   - source-map-support 0.5.4 -> 0.5.6

# v1.1.0 (Apr 9, 2018)

 * Added ability to cancel a pending `debounce()`.
   [(DAEMON-238)](https://jira.appcelerator.org/browse/DAEMON-238)
 * Improved readme.
 * Updated dependencies:
   - appcd-gulp 1.0.1 -> 1.1.1
   - source-map-support 0.5.0 -> 0.5.4

# v1.0.1 (Dec 15, 2017)

 * Updated dependencies:
   - appcd-gulp 1.0.0 -> 1.0.1

# v1.0.0 (Dec 5, 2017)

 - Initial release.
