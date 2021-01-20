# Appc Daemon 2.5.0

## Jun 13, 2019

This is a minor release with new features, bug fixes, and dependency updates.

### Installation

```
npm i -g appcd@2.5.0
```

### appcd

 * **v2.5.0** - 6/13/2019

   * chore: Updated to `appcd-client@2.0.0`, `appcd-core@2.6.0`, and `appcd-nodejs@2.0.0`.

### appcd-client

 * **v2.0.0** - 6/13/2019

   * BREAKING CHANGE: Updated to `appcd-response@2.0.0`.

 * **v1.3.4** - 6/13/2019

   * Republish of v1.3.1.

### appcd-config-service

 * **v1.2.3** - 6/13/2019

   * Republish of v1.2.1.

### appcd-core

 * **v2.6.0** - 6/13/2019

   * chore: Updated to `appcd-config-service@1.2.3`, `appcd-dispatcher@2.0.0`,
     `appcd-fswatch-manager@2.0.0`, `appcd-nodejs@2.0.0`, `appcd-plugin@2.1.0`,
     `appcd-subprocess@2.0.1`, and `appcd-telemetry@2.0.1`.

 * **v2.5.0** - 6/10/2019

   * chore: Updated to `appcd-plugin@2.0.0` and `appcd-telemetry@2.0.0`.
   * chore: Updated to `appcd-default-plugins@2.0.0`.

### appcd-detect

 * **v2.1.0** - 6/13/2019

   * chore: Updated to `appcd-dispatcher@2.0.0`, `appcd-fswatch-manager@2.0.0`, and
     `appcd-subprocess@2.0.1`.

 * **v2.0.0** - 6/10/2019

   * BREAKING CHANGE: Bumped minimum required Node.js version from v8.0.0 to v8.12.0.
   * misc: Added more debug logging around the default path determination.
   * feat: Replaced `appcd-winreg` with `winreglib`.
     [(DAEMON-276)](https://jira.appcelerator.org/browse/DAEMON-276)
   * chore: Updated dependencies.

### appcd-dispatcher

 * **v2.0.0** - 6/13/2019

   * BREAKING CHANGE: Updated to `appcd-response@2.0.0`.

 * **v1.4.2** - 6/13/2019

   * chore: Republish of v1.4.0.

### appcd-fswatch-manager

 * **v2.0.0** - 6/13/2019

   * BREAKING CHANGE: Updated to `appcd-dispatche@2.0.0` and `appcd-response@2.0.0`.

 * **v1.1.3** - 6/13/2019

   * chore: Republish of v1.1.1.

### appcd-machine-id

 * **v2.0.1** - 6/13/2019

   * chore: Updated to `appcd-subprocess@2.0.1`.

 * **v2.0.0** - 6/10/2019

   * BREAKING CHANGE: Bumped minimum required Node.js version from v8.0.0 to v8.12.0.
   * feat: Replaced `appcd-winreg` with `winreglib`.
     [(DAEMON-276)](https://jira.appcelerator.org/browse/DAEMON-276)
   * chore: Updated dependencies.

### appcd-nodejs

 * **v2.0.0** - 6/13/2019

   * BREAKING CHANGE: Updated to `appcd-request@2.0.0`.

### appcd-plugin

 * **v2.1.0** - 6/13/2019

   * chore: Updated to `appcd-client@2.0.0`, `appcd-config-service@1.2.3`, `appcd-detect@2.1.0`,
     `appcd-dispatcher@2.0.0`, `appcd-fswatch-manager@2.0.0`, `appcd-machine-id@2.0.1`,
     `appcd-nodejs@2.0.0`, `appcd-request@2.0.0`, `appcd-subprocess@2.0.1`, and
     `appcd-telemetry@2.0.1`.

 * **v2.0.0** - 6/10/2019

   * BREAKING CHANGE: Updated to `appcd-detect@2.0.0`, `appcd-machine-id@2.0.0`, and
     `appcd-telemetry@2.0.0`.
   * fix: Replaced call to `formatWithOptions()` with `format()` so that appcd@1.x would not break
     on Node.js 8.11.2. [(DAEMON-281)](https://jira.appcelerator.org/browse/DAEMON-281)
   * fix: Fixed support for scoped plugin package names for nested directory schemes.

### appcd-request

 * **v2.0.0** - 6/13/2019

   * BREAKING CHANGE: Updated to `appcd-dispatcher@2.0.0`.

### appcd-subprocess

 * **v2.0.1** - 6/13/2019

   * BREAKING CHANGE: Updated to `appcd-response@2.0.0`.

 * **v2.0.0** - 6/13/2019

   * Botched release.

 * **v1.3.2** - 6/13/2019

   * chore: Republish of v1.3.0.

### appcd-telemetry

 * **v2.0.1** - 6/13/2019

   * chore: Updated to `appcd-dispatcher@2.0.0`, `appcd-machine-id@2.0.1`, and `appcd-request@2.0.0`.

 * **v2.0.0** - 6/10/2019

   * BREAKING CHANGE: Updated to `appcd-machine-id@2.0.0`.
   * refactor: Updated telemetry payload to latest specifications.
   * feat: Added `/crash` endpoint to report crash information.
   * chore: Updated dependencies.