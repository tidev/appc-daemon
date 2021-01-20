# Appc Daemon 3.0.0

## Aug 13, 2019

This is a major release with breaking changes, new features, bug fixes, and dependency updates.

### Installation

```
npm i -g appcd@3.0.0
```

### appcd

 * **v3.0.0** - 8/13/2019

   * chore: Fixed eslint `hasOwnProperty` warnings.
   * chore: Updated dependencies

### appcd-agent

 * **v1.1.7** - 8/13/2019

   * chore: Fixed eslint `hasOwnProperty` warnings.
   * chore: Updated dependencies.

### appcd-client

 * **v2.0.1** - 8/13/2019

   * chore: Updated dependencies

### appcd-config

 * **v1.3.1** - 8/13/2019

   * fix: Fixed bug when pushing a config value to an existing key with null value.
   * chore: Fixed eslint `hasOwnProperty` warnings.
   * chore: Updated dependencies.

### appcd-config-service

 * **v2.0.1** - 8/13/2019

   * chore: Updated dependencies.

### appcd-core

 * **v3.0.0** - 8/13/2019

   * BREAKING CHANGE: Updated to `appcd-default-plugins@4.0.0`, `appcd-nodejs@3.0.0`,
     `appcd-plugin@3.0.0`, `appcd-subprocess@3.0.0`, `appcd-telemetry@3.0.0`, and `appcd-util@2.0.0`.
   * fix: Added `sid` to WebSocketSession context so remote clients will know the subscription id.
   * fix: Fixed bug where `server.hostname` was not being correctly referenced.
   * chore: Bumped Node.js version from 10.15.3 to 10.16.2.
   * chore: Updated configuration setting descriptions and metadata.
   * chore: Updated dependencies

### appcd-default-plugins

 * **v4.0.0** - 8/13/2019

   * BREAKING CHANGE: `appcd-default-plugins` supports both postinstall and runtime installation of
     default plugins.
   * chore: Updated dependencies.

### appcd-detect

 * **v2.2.0** - 8/13/2019

   * feat: Updated `registryKeys` option for more advanced Windows Registry handling.
   * chore: Updated dependencies.

### appcd-dispatcher

 * **v2.0.1** - 8/13/2019

   * chore: Fixed eslint `hasOwnProperty` warnings.
   * chore: Updated dependencies.

### appcd-fs

 * **v1.1.8** - 8/13/2019

   * chore: Updated dependencies.

### appcd-fswatch-manager

 * **v2.0.1** - 8/13/2019

   * chore: Updated dependencies.
   * chore: Commented out debug log output of FS watcher tree state because it was too noisy.

### appcd-fswatcher

 * **v1.2.3** - 8/13/2019

   * chore: Updated dependencies.

### appcd-gulp

 * **v2.2.0** - 8/13/2019

   * feat: Added Node 12 Babel profile.
     [(DAEMON-275)](https://jira.appcelerator.org/browse/DAEMON-275)
   * chore: Updated to `eslint-config-axway@4.3.0` which added eslint 6 support and added Node.js
     eslint rules.
   * chore: Disabled `require-atomic-updates` rule.
   * chore: Removed deprecated @babel/polyfill.
   * chore: Updated dependencies.

### appcd-http

 * **v1.2.3** - 8/13/2019

   * chore: Updated dependencies.

### appcd-logger

 * **v2.0.3** - 8/13/2019

   * chore: Updated dependencies.

### appcd-machine-id

 * **v3.0.1** - 8/13/2019

   * BREAKING CHANGE: Updated to `appcd-subprocess@3.0.0`.
   * chore: Updated dependencies.

### appcd-nodejs

 * **v3.0.0** - 8/13/2019

   * BREAKING CHANGE: Updated to `appcd-util@2.0.0`.
   * chore: Updated dependencies.

### appcd-path

 * **v1.1.7** - 8/13/2019

   * chore: Updated dependencies.

### appcd-plugin

 * **v3.0.0** - 8/13/2019

   * BREAKING CHANGE: Updated to `appcd-machine-id@3.0.1`, `appcd-nodejs@3.0.0`,
     `appcd-subprocess@3.0.0`, `appcd-telemetry@3.0.0`, and `appcd-util@2.0.0`.
   * chore: Fixed eslint `hasOwnProperty` warnings.
   * chore: Updated dependencies.

 * **v2.2.0** - 6/25/2019

   * chore: Updated to `appcd-config-service@2.0.0`.

### appcd-request

 * **v2.1.0** - 8/13/2019

   * fix: Fixed request config setting precedence such that environment variables override config
     settings.
   * chore: Updated dependencies.

### appcd-response

 * **v2.0.1** - 8/13/2019

   * chore: Fixed eslint `hasOwnProperty` warnings.
   * chore: Updated dependencies.

### appcd-subprocess

 * **v3.0.0** - 8/13/2019

   * BREAKING CHANGE: Updated to `appcd-nodejs@3.0.0`.
   * chore: Fixed eslint `hasOwnProperty` warnings.
   * chore: Updated dependencies.

### appcd-telemetry

 * **v3.0.0** - 8/13/2019

   * BREAKING CHANGE: Updated to `appcd-machine-id@3.0.0`.
   * fix: Fixed bug where events were sent out-of-order if there was a connection error sending a
     batch of data.
   * fix: Fixed bug where the next schuduled sending of events was stopped if shutdown prior to
     scheduling.
   * fix: Fixed live config changes for environment name.
   * chore: Updated dependencies.

### appcd-util

 * **v2.0.0** - 8/13/2019

   * BREAKING CHANGE: Bumped minimum supported Node.js version from `>=8.0.0` to `>=8.1.0` to fix
     issue where 8.0.x didn't support `async_hooks.createHook()`, yet `appcd-util` was using it.
   * chore: Updated dependencies

### appcd-winreg

 * **v1.1.7** - 8/13/2019

   * chore: Updated dependencies.