# Appc Daemon 2.5.0

## Jun 13, 2019

This is a minor release with new features, bug fixes, and dependency updates.

### Installation

```
npm i -g appcd@2.5.0
```

### appcd@2.5.0

 * chore: Updated to `appcd-client@2.0.0`, `appcd-core@2.6.0`, and `appcd-nodejs@2.0.0`.

### appcd-client@1.3.4

 * Republish of v1.3.1.

### appcd-client@2.0.0

 * BREAKING CHANGE: Updated to `appcd-response@2.0.0`.

### appcd-config-service@1.2.3

 * Republish of v1.2.1.

### appcd-core@2.5.0

 * chore: Updated to `appcd-plugin@2.0.0` and `appcd-telemetry@2.0.0`.
 * chore: Updated to `appcd-default-plugins@2.0.0`.

### appcd-core@2.6.0

 * chore: Updated to `appcd-config-service@1.2.3`, `appcd-dispatcher@2.0.0`,
   `appcd-fswatch-manager@2.0.0`, `appcd-nodejs@2.0.0`, `appcd-plugin@2.1.0`,
   `appcd-subprocess@2.0.1`, and `appcd-telemetry@2.0.1`.

### appcd-detect@2.0.0

 * BREAKING CHANGE: Bumped minimum required Node.js version from v8.0.0 to v8.12.0.
 * misc: Added more debug logging around the default path determination.
 * feat: Replaced `appcd-winreg` with `winreglib`.
   [(DAEMON-276)](https://jira.appcelerator.org/browse/DAEMON-276)
 * chore: Updated dependencies.

### appcd-detect@2.1.0

 * chore: Updated to `appcd-dispatcher@2.0.0`, `appcd-fswatch-manager@2.0.0`, and
   `appcd-subprocess@2.0.1`.

### appcd-dispatcher@1.4.2

 * chore: Republish of v1.4.0.

### appcd-dispatcher@2.0.0

 * BREAKING CHANGE: Updated to `appcd-response@2.0.0`.

### appcd-fswatch-manager@1.1.3

 * chore: Republish of v1.1.1.

### appcd-fswatch-manager@2.0.0

 * BREAKING CHANGE: Updated to `appcd-dispatche@2.0.0` and `appcd-response@2.0.0`.

### appcd-machine-id@2.0.0

 * BREAKING CHANGE: Bumped minimum required Node.js version from v8.0.0 to v8.12.0.
 * feat: Replaced `appcd-winreg` with `winreglib`.
   [(DAEMON-276)](https://jira.appcelerator.org/browse/DAEMON-276)
 * chore: Updated dependencies.

### appcd-machine-id@2.0.1

 * chore: Updated to `appcd-subprocess@2.0.1`.

### appcd-nodejs@2.0.0

 * BREAKING CHANGE: Updated to `appcd-request@2.0.0`.

### appcd-plugin@2.0.0

 * BREAKING CHANGE: Updated to `appcd-detect@2.0.0`, `appcd-machine-id@2.0.0`, and
   `appcd-telemetry@2.0.0`.
 * fix: Replaced call to `formatWithOptions()` with `format()` so that appcd@1.x would not break
   on Node.js 8.11.2. [(DAEMON-281)](https://jira.appcelerator.org/browse/DAEMON-281)
 * fix: Fixed support for scoped plugin package names for nested directory schemes.

### appcd-plugin@2.1.0

 * chore: Updated to `appcd-client@2.0.0`, `appcd-config-service@1.2.3`, `appcd-detect@2.1.0`,
   `appcd-dispatcher@2.0.0`, `appcd-fswatch-manager@2.0.0`, `appcd-machine-id@2.0.1`,
   `appcd-nodejs@2.0.0`, `appcd-request@2.0.0`, `appcd-subprocess@2.0.1`, and
   `appcd-telemetry@2.0.1`.

### appcd-request@2.0.0

 * BREAKING CHANGE: Updated to `appcd-dispatcher@2.0.0`.

### appcd-subprocess@1.3.2

 * chore: Republish of v1.3.0.

### appcd-subprocess@2.0.0

 * Botched release.

### appcd-subprocess@2.0.1

 * BREAKING CHANGE: Updated to `appcd-response@2.0.0`.

### appcd-telemetry@2.0.0

 * BREAKING CHANGE: Updated to `appcd-machine-id@2.0.0`.
 * refactor: Updated telemetry payload to latest specifications.
 * feat: Added `/crash` endpoint to report crash information.
 * chore: Updated dependencies.

### appcd-telemetry@2.0.1

 * chore: Updated to `appcd-dispatcher@2.0.0`, `appcd-machine-id@2.0.1`, and `appcd-request@2.0.0`.