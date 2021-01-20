# Appc Daemon 2.0.0

## Nov 27, 2018

This is a major release with breaking changes, new features, bug fixes, and dependency updates.

### Installation

```
npm i -g appcd@2.0.0
```

### appcd

 * **v2.0.0** - 11/27/2018

   * feat: Added `v8-compile-cache` to noticeably speed up execute.
   * chore: Updated to latest `cli-kit`:
     - Enable `appcd` to be a proper `cli-kit` extension.
     - Added banner
     - Removed `--no-colors` since `cli-kit` now handles this for us.
   * fix: Updated all commands to import dependencies in their action handlers instead of the top of the
     file yielding in an approximately 30% speed bump.
   * refactor: Moved all commands into a `commands` subdirectory.
   * fix: Fixed extra `}` in user agent.
   * fix: Fixed `appcd config ls` (and `list`) actions.
   * fix: Removed unnecessary subscribe logic when rendering `exec` command responses.
     [(DAEMON-266)](https://jira.appcelerator.org/browse/DAEMON-266)
   * chore: Updated dependencies.

### appcd-agent

 * **v1.1.3** - 11/27/2018

   * chore: Updated dependencies.

### appcd-client

 * **v1.1.2** - 11/27/2018

   * fix: Fixed handling streamed responses, specifically knowing when the last message has been
     sent. [(DAEMON-266)](https://jira.appcelerator.org/browse/DAEMON-266)
   * chore: Updated dependencies.

### appcd-config

 * **v1.1.3** - 11/27/2018

   * chore: Updated dependencies.
   * refactor: Moved from babylon to @babel/parser

 * **v1.1.2** - 9/17/2018

   * chore: Updated dependencies.

### appcd-config-service

 * **v1.1.2** - 11/27/2018

   * fix: Fixed debug logging of undefined filter.
   * chore: Updated dependencies.

### appcd-core

 * **v2.0.0** - 11/27/2018

   * BREAKING CHANGE: Bumped minimum Node.js version from 8.0.0 to 8.10.0.
   * chore: Bumped preferred Node.js version from 8.11.1 to 10.13.0.
   * feat: Wired up telemetry for dispatched HTTP and WebSocket requests.
   * fix: Updated telemetry event names:
     - `appcd.server.start` -> `ti.start`
     - `appcd.server.shutdown` -> ti.end`
     - `appcd.server.nodePurge` -> `appcd.server.node_purge`
   * feat: `WebSocketSession` now extends `EventEmitter` and emits a `request` event when a request
     completes.
   * fix: Improved `WebSocketSession` request handling to be more consistent.
   * feat: Added `AMPLIFY_CLI` version to telemetry payload.
     [(DAEMON-263)](https://jira.appcelerator.org/browse/DAEMON-263)
   * fix: Fixed bug where streamed responses only sent `fin` flag for last pubsub event instead of
     all streamed responses. [(DAEMON-266)](https://jira.appcelerator.org/browse/DAEMON-266)
   * chore: Updated dependencies.

### appcd-default-plugins

 * **v1.1.4** - 11/27/2018

   * refactor: Migrated to new `@appcd/` scoped package names.

### appcd-detect

 * **v1.1.2** - 11/27/2018

   * chore: Updated dependencies.

### appcd-dispatcher

 * **v1.2.1** - 11/27/2018

   * chore: Updated dependencies.

 * **v1.2.0** - 9/17/2018

   * fix: Removed support for period delimited filters in `DataServiceDispatcher`.
   * feat: Added `startTime`, `status`, and `time` to `DispatcherContext`.
   * refactor: Cleaned up Koa middleware callback and added a `onRequest` callback for telemetry.
   * fix: Fixed bug where `Dispatcher.call()` throws an error instead of returning a rejected promise.
   * chore: Updated dependencies.

### appcd-fs

 * **v1.1.4** - 11/26/2018

   * chore: Updated dependencies.

 * **v1.1.3** - 9/17/2018

   * chore: Updated dependencies.

### appcd-fswatch-manager

 * **v1.0.2** - 11/27/2018

   * chore: Updated dependencies.

### appcd-fswatcher

 * **v1.1.2** - 11/27/2018

   * chore: Updated dependencies.

### appcd-gulp

 * **v1.2.1** - 11/26/2018

   * chore: Updated dependencies.

 * **v1.2.0** - 9/17/2018

   * Added a `package` template which adds `package` and `clean-package` tasks that bundle a package
     using Webpack.
   * Replaced `del.sync()` with fs-extra's `removeSync()`.
     [(DAEMON-258)](https://jira.appcelerator.org/browse/DAEMON-258)
   * Fixed bug in `test-transpile` with instrumenting coverage reporting in files that implicitly
     import the `index` file when referencing the `dist` directory.
   * Removed Babel decorators transform plugin.
   * Removed Babel minify preset.
   * Added Node 8.10 and 10.0 Babel configs.
   * Upgraded to latest Babel version.
   * Updated dependencies.

### appcd-http

 * **v1.1.2** - 11/27/2018

   * chore: Updated dependencies.

### appcd-logger

 * **v1.1.3** - 11/27/2018

   * chore: Updated dependencies.

 * **v1.1.2** - 9/17/2018

   * chore: Updated dependencies.

### appcd-machine-id

 * **v1.1.2** - 11/27/2018

   * chore: Updated dependencies.

### appcd-nodejs

 * **v1.1.3** - 11/27/2018

   * chore: Updated dependencies.

 * **v1.1.2** - 9/17/2018

   * chore: Updated dependencies.

### appcd-path

 * **v1.1.3** - 11/26/2018

   * chore: Updated dependencies.

 * **v1.1.2** - 9/17/2018

   * chore: Updated dependencies.

### appcd-plugin

 * **v1.1.3** - 11/27/2018

   * fix: Fixed plugin telemetry so that it doesn't send events during the initial scan or shutdown.
   * fix: Fixed lint issue with code indention.
   * feat: Added support for streamed responses through the IPC tunnel.
     [(DAEMON-262)](https://jira.appcelerator.org/browse/DAEMON-262)
   * feat: Added list of plugin's services to the default plugin info route.
     [(DAEMON-265)](https://jira.appcelerator.org/browse/DAEMON-265)
   * feat: Added `appcd-plugin` to the list of injected appcd packages into plugins.
   * chore: Improved debug log namespace names.
   * chore: Updated dependencies.

### appcd-request

 * **v1.1.3** - 11/27/2018

   * chore: Updated dependencies.

 * **v1.1.2** - 9/17/2018

   * chore: Updated dependencies.

### appcd-response

 * **v1.1.4** - 11/27/2018

   * chore: Updated dependencies.

 * **v1.1.3** - 9/17/2018

   * fix: Telemetry payload changed:
     - Added `app_version`, `os`, `osver`, `platform`
     - Fixed `deploytype`, `ts`, `ver`
     - Removed `params`
   * feat: Added support for `ti.start` and `ti.end`.
   * refactor: Refactored sending events to support flushing all events.
   * chore: Updated dependencies.

### appcd-subprocess

 * **v1.1.3** - 11/27/2018

   * feat: Added `/send/:pid?` service endpoint for sending an IPC message to a subprocess.
   * chore: Updated dependencies.

 * **v1.1.2** - 9/17/2018

   * chore: Updated dependencies.

### appcd-telemetry

 * **v1.1.2** - 11/27/2018

   * chore: Updated dependencies.

### appcd-util

 * **v1.1.4** - 11/26/2018

   * chore: Updated dependencies.

 * **v1.1.3** - 11/26/2018

   * chore: Updated dependencies.

 * **v1.1.2** - 9/17/2018

   * feat: Added `osInfo()` function to get operating system name and version.
   * chore: Removed unused variables in tests.
   * chore: Updated dependencies.

### appcd-winreg

 * **v1.1.3** - 11/27/2018

   * chore: Updated dependencies.

 * **v1.1.2** - 9/17/2018

   * chore: Updated dependencies.