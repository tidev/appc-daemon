# Appc Daemon 2.0.1

## Jan 16, 2019

This is a patch release with bug fixes and minor dependency updates.

### Installation

```
npm i -g appcd@2.0.1
```

### appcd@2.0.1

 * fix(config): Actions were not being translated correctly when dispatching request to daemon
   config service.
   [(DAEMON-269)](https://jira.appcelerator.org/browse/DAEMON-269)
 * fix: Added humanize dependency since it was removed from snooplogg 2.
 * refactor: Refactored promises to async/await.
 * chore: Updated dependencies.

### appcd-agent@1.1.4

 * refactor: Refactored promises to async/await.
 * chore: Updated dependencies.

### appcd-client@1.1.3

 * chore: Updated dependencies.

### appcd-config@1.1.4

 * chore: Updated dependencies.

### appcd-config-service@1.1.3

 * chore: Updated dependencies.

### appcd-core@2.0.1

 * fix: Removed `getActiveHandles()` call which no longer works in Node.js 11 and switched to
   `trackTimers()` which uses async hooks and works with Node.js 8.1.0 or newer.
   [(DAEMON-268)](https://jira.appcelerator.org/browse/DAEMON-268)
 * fix: Added humanize dependency since it was removed from snooplogg 2.
 * refactor: Refactored promises to async/await.
 * chore: Bumped Node.js version from 8.13.0 to 10.15.0.
 * chore: Updated dependencies.

### appcd-detect@1.1.3

 * fix: Added pluralize dependency since it was removed from snooplogg 2.
 * refactor: Refactored promises to async/await.
 * chore: Updated dependencies.

### appcd-dispatcher@1.2.2

 * fix: Added pluralize dependency since it was removed from snooplogg 2.
 * refactor: Refactored promises to async/await.
 * chore: Updated dependencies.

### appcd-fs@1.1.5

 * chore: Updated dependencies.

### appcd-fswatch-manager@1.0.3

 * chore: Updated dependencies.

### appcd-fswatcher@1.1.3

 * fix: Fixed bug where directories becoming unrestricted were not sending correct "add"
   notifications for child files and directories.
 * fix: Added pluralize dependency since it was removed from snooplogg 2.
 * chore: Updated dependencies.

### appcd-gulp@2.0.0

 * BREAKING CHANGE: Upgraded to Gulp 4.
 * chore: Added chai and promise lint rules.
 * chore: Updated dependencies.

### appcd-http@1.1.3

 * fix: Added pluralize dependency since it was removed from snooplogg 2.
 * chore: Updated dependencies.

### appcd-logger@1.1.4

 * **UNPUBLISHED ON JAN 24, 2019**
   - v1.1.4 upgraded snooplogg to v2.x which had public API changes that affected appcd-logger.
 * chore: Updated dependencies.

### appcd-machine-id@1.1.3

 * refactor: Refactored promises to async/await.
 * chore: Updated dependencies.

### appcd-nodejs@1.1.4

 * fix: Added pluralize dependency since it was removed from snooplogg 2.
 * refactor: Refactored promises to async/await.
 * chore: Updated dependencies.

### appcd-path@1.1.4

 * chore: Updated dependencies.

### appcd-plugin@1.1.4

 * fixL Added pluralize dependency since it was removed from snooplogg 2.
 * refactor: Refactored promises to async/await.
 * chore: Updated dependencies.

### appcd-request@1.1.4

 * fix: Added humanize dependency since it was removed from snooplogg 2.
 * chore: Updated dependencies.

### appcd-response@1.1.5

 * chore: Updated dependencies.

### appcd-subprocess@1.1.4

 * refactor: Refactored promises to async/await.
 * chore: Updated dependencies.

### appcd-telemetry@1.1.3

 * chore: Updated dependencies.

### appcd-util@1.1.5

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

### appcd-winreg@1.1.4

 * chore: Updated dependencies.