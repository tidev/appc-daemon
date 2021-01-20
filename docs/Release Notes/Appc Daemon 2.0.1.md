# Appc Daemon 2.0.1

## Jan 16, 2019

This is a patch release with bug fixes and minor dependency updates.

### Installation

```
npm i -g appcd@2.0.1
```

### appcd

 * **v2.0.1** - 1/16/2019

   * fix(config): Actions were not being translated correctly when dispatching request to daemon
     config service.
     [(DAEMON-269)](https://jira.appcelerator.org/browse/DAEMON-269)
   * fix: Added humanize dependency since it was removed from snooplogg 2.
   * refactor: Refactored promises to async/await.
   * chore: Updated dependencies.

### appcd-agent

 * **v1.1.4** - 1/16/2019

   * refactor: Refactored promises to async/await.
   * chore: Updated dependencies.

### appcd-client

 * **v1.1.3** - 1/16/2019

   * chore: Updated dependencies.

### appcd-config

 * **v1.1.4** - 1/16/2019

   * chore: Updated dependencies.

### appcd-config-service

 * **v1.1.3** - 1/16/2019

   * chore: Updated dependencies.

### appcd-core

 * **v2.0.1** - 1/16/2019

   * fix: Removed `getActiveHandles()` call which no longer works in Node.js 11 and switched to
     `trackTimers()` which uses async hooks and works with Node.js 8.1.0 or newer.
     [(DAEMON-268)](https://jira.appcelerator.org/browse/DAEMON-268)
   * fix: Added humanize dependency since it was removed from snooplogg 2.
   * refactor: Refactored promises to async/await.
   * chore: Bumped Node.js version from 8.13.0 to 10.15.0.
   * chore: Updated dependencies.

### appcd-detect

 * **v1.1.3** - 1/16/2019

   * fix: Added pluralize dependency since it was removed from snooplogg 2.
   * refactor: Refactored promises to async/await.
   * chore: Updated dependencies.

### appcd-dispatcher

 * **v1.2.2** - 1/16/2019

   * fix: Added pluralize dependency since it was removed from snooplogg 2.
   * refactor: Refactored promises to async/await.
   * chore: Updated dependencies.

### appcd-fs

 * **v1.1.5** - 1/16/2019

   * chore: Updated dependencies.

### appcd-fswatch-manager

 * **v1.0.3** - 1/16/2019

   * chore: Updated dependencies.

### appcd-fswatcher

 * **v1.1.3** - 1/16/2019

   * fix: Fixed bug where directories becoming unrestricted were not sending correct "add"
     notifications for child files and directories.
   * fix: Added pluralize dependency since it was removed from snooplogg 2.
   * chore: Updated dependencies.

### appcd-gulp

 * **v2.0.0** - 1/16/2019

   * BREAKING CHANGE: Upgraded to Gulp 4.
   * chore: Added chai and promise lint rules.
   * chore: Updated dependencies.

### appcd-http

 * **v1.1.3** - 1/16/2019

   * fix: Added pluralize dependency since it was removed from snooplogg 2.
   * chore: Updated dependencies.

### appcd-logger

 * **v1.1.4** - 1/16/2019

   * **UNPUBLISHED ON JAN 24, 2019**
     - v1.1.4 upgraded snooplogg to v2.x which had public API changes that affected appcd-logger.
   * chore: Updated dependencies.

### appcd-machine-id

 * **v1.1.3** - 1/16/2019

   * refactor: Refactored promises to async/await.
   * chore: Updated dependencies.

### appcd-nodejs

 * **v1.1.4** - 1/16/2019

   * fix: Added pluralize dependency since it was removed from snooplogg 2.
   * refactor: Refactored promises to async/await.
   * chore: Updated dependencies.

### appcd-path

 * **v1.1.4** - 1/16/2019

   * chore: Updated dependencies.

### appcd-plugin

 * **v1.1.4** - 1/16/2019

   * fixL Added pluralize dependency since it was removed from snooplogg 2.
   * refactor: Refactored promises to async/await.
   * chore: Updated dependencies.

### appcd-request

 * **v1.1.4** - 1/16/2019

   * fix: Added humanize dependency since it was removed from snooplogg 2.
   * chore: Updated dependencies.

### appcd-response

 * **v1.1.5** - 1/16/2019

   * chore: Updated dependencies.

### appcd-subprocess

 * **v1.1.4** - 1/16/2019

   * refactor: Refactored promises to async/await.
   * chore: Updated dependencies.

### appcd-telemetry

 * **v1.1.3** - 1/16/2019

   * chore: Updated dependencies.

### appcd-util

 * **v1.1.5** - 1/16/2019

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

### appcd-winreg

 * **v1.1.4** - 1/16/2019

   * chore: Updated dependencies.