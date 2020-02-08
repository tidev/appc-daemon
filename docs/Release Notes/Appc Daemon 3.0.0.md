# Appc Daemon 3.0.0

## Aug 13, 2019

This is a major release with breaking changes, new features, bug fixes, and dependency updates.

### Installation

```
npm i -g appcd@3.0.0
```

### appcd@3.0.0

 * chore: Fixed eslint `hasOwnProperty` warnings.
 * chore: Updated dependencies

### appcd-agent@1.1.7

 * chore: Fixed eslint `hasOwnProperty` warnings.
 * chore: Updated dependencies.

### appcd-client@2.0.1

 * chore: Updated dependencies

### appcd-config@1.3.1

 * fix: Fixed bug when pushing a config value to an existing key with null value.
 * chore: Fixed eslint `hasOwnProperty` warnings.
 * chore: Updated dependencies.

### appcd-config-service@2.0.1

 * chore: Updated dependencies.

### appcd-core@3.0.0

 * BREAKING CHANGE: Updated to `appcd-default-plugins@4.0.0`, `appcd-nodejs@3.0.0`,
   `appcd-plugin@3.0.0`, `appcd-subprocess@3.0.0`, `appcd-telemetry@3.0.0`, and `appcd-util@2.0.0`.
 * fix: Added `sid` to WebSocketSession context so remote clients will know the subscription id.
 * fix: Fixed bug where `server.hostname` was not being correctly referenced.
 * chore: Bumped Node.js version from 10.15.3 to 10.16.2.
 * chore: Updated configuration setting descriptions and metadata.
 * chore: Updated dependencies

### appcd-default-plugins@4.0.0

 * BREAKING CHANGE: `appcd-default-plugins` supports both postinstall and runtime installation of
   default plugins.
 * chore: Updated dependencies.

### appcd-detect@2.2.0

 * feat: Updated `registryKeys` option for more advanced Windows Registry handling.
 * chore: Updated dependencies.

### appcd-dispatcher@2.0.1

 * chore: Fixed eslint `hasOwnProperty` warnings.
 * chore: Updated dependencies.

### appcd-fs@1.1.8

 * chore: Updated dependencies.

### appcd-fswatch-manager@2.0.1

 * chore: Updated dependencies.
 * chore: Commented out debug log output of FS watcher tree state because it was too noisy.

### appcd-fswatcher@1.2.3

 * chore: Updated dependencies.

### appcd-gulp@2.2.0

 * feat: Added Node 12 Babel profile.
   [(DAEMON-275)](https://jira.appcelerator.org/browse/DAEMON-275)
 * chore: Updated to `eslint-config-axway@4.3.0` which added eslint 6 support and added Node.js
   eslint rules.
 * chore: Disabled `require-atomic-updates` rule.
 * chore: Removed deprecated @babel/polyfill.
 * chore: Updated dependencies.

### appcd-http@1.2.3

 * chore: Updated dependencies.

### appcd-logger@2.0.3

 * chore: Updated dependencies.

### appcd-machine-id@2.0.2

 * Botched release.

### appcd-machine-id@3.0.0

 * Botched release.

### appcd-machine-id@3.0.1

 * BREAKING CHANGE: Updated to `appcd-subprocess@3.0.0`.
 * chore: Updated dependencies.

### appcd-nodejs@3.0.0

 * BREAKING CHANGE: Updated to `appcd-util@2.0.0`.
 * chore: Updated dependencies.

### appcd-path@1.1.7

 * chore: Updated dependencies.

### appcd-plugin@2.2.0

 * chore: Updated to `appcd-config-service@2.0.0`.

### appcd-plugin@3.0.0

 * BREAKING CHANGE: Updated to `appcd-machine-id@3.0.1`, `appcd-nodejs@3.0.0`,
   `appcd-subprocess@3.0.0`, `appcd-telemetry@3.0.0`, and `appcd-util@2.0.0`.
 * chore: Fixed eslint `hasOwnProperty` warnings.
 * chore: Updated dependencies.

### appcd-request@2.1.0

 * fix: Fixed request config setting precedence such that environment variables override config
   settings.
 * chore: Updated dependencies.

### appcd-response@2.0.1

 * chore: Fixed eslint `hasOwnProperty` warnings.
 * chore: Updated dependencies.

### appcd-subprocess@2.0.2

 * Botched release.

### appcd-subprocess@3.0.0

 * BREAKING CHANGE: Updated to `appcd-nodejs@3.0.0`.
 * chore: Fixed eslint `hasOwnProperty` warnings.
 * chore: Updated dependencies.

### appcd-telemetry@2.0.2

 * Botched release.

### appcd-telemetry@3.0.0

 * BREAKING CHANGE: Updated to `appcd-machine-id@3.0.0`.
 * fix: Fixed bug where events were sent out-of-order if there was a connection error sending a
   batch of data.
 * fix: Fixed bug where the next schuduled sending of events was stopped if shutdown prior to
   scheduling.
 * fix: Fixed live config changes for environment name.
 * chore: Updated dependencies.

### appcd-util@2.0.0

 * BREAKING CHANGE: Bumped minimum supported Node.js version from `>=8.0.0` to `>=8.1.0` to fix
   issue where 8.0.x didn't support `async_hooks.createHook()`, yet `appcd-util` was using it.
 * chore: Updated dependencies

### appcd-winreg@1.1.7

 * chore: Updated dependencies.