# Appc Daemon 3.2.0

## Jan 13, 2020

This is a minor release with new features, bug fixes, and dependency updates.

### Installation

```
npm i -g appcd@3.2.0
```

### appcd

 * **v3.2.0** - 1/13/2020

   * fix: Fixed `--config` and `--config-file` format to require a value.
   * chore: Updated dependencies.

### appcd-agent

 * **v1.1.9** - 1/8/2020

   * chore: Updated dependencies.

### appcd-client

 * **v2.0.4** - 1/13/2020

   * fix: Fixed bug where chunked responses that didn't contain a status were treated as 500 errors
     and the client would disconnect.
   * chore: Updated dependencies.

 * **v2.0.3** - 1/8/2020

   * chore: Updated dependencies.

### appcd-config

 * **v2.0.2** - 1/13/2020

   * chore: Updated dependencies.

 * **v2.0.1** - 1/8/2020

   * chore: Updated dependencies.

### appcd-config-service

 * **v2.0.3** - 1/8/2020

   * chore: Updated dependencies.

### appcd-core

 * **v3.2.0** - 1/13/2020

   * fix: Fixed `--config` and `--config-file` format to require a value.
   * fix: Await `PluginManager` to initialize.
     [(DAEMON-308)](https://jira.appcelerator.org/browse/DAEMON-308)
   * fix: Removed `status` and `statusCode` from subsequent non-pubsub chunked responses.
   * chore: Updated dependencies.

### appcd-default-plugins

 * **v4.2.0** - 1/13/2020

   * fix: Gracefully handle error when yarn links directory exists, but access is denied.
     [(DAEMON-307)](https://jira.appcelerator.org/browse/DAEMON-307)
   * chore: Added latest versions of the plugins.
   * chore: Fixed homepage and repository URLs in `package.json`.
   * chore: Added links to issue trackers in readme.
   * chore: Updated dependencies.

### appcd-detect

 * **v2.2.3** - 1/10/2020

   * fix: Only use a single recursive file watcher instead of watching each found path when recursive
     and redetect flags are set.

 * **v2.2.2** - 1/8/2020

   * chore: Updated dependencies.

### appcd-dispatcher

 * **v2.0.3** - 1/8/2020

   * chore: Updated dependencies.

### appcd-fs

 * **v1.1.10** - 1/8/2020

   * chore: Updated dependencies.

### appcd-fswatch-manager

 * **v2.0.3** - 1/8/2020

   * chore: Updated dependencies.

### appcd-fswatcher

 * **v1.2.5** - 1/8/2020

   * chore: Updated dependencies.

### appcd-gulp

 * **v2.3.2** - 1/13/2020

   * chore: Updated dependencies.

 * **v2.3.1** - 1/8/2020

   * refactor: Moved Node version specific Babel configs into separate files.
   * chore: Updated dependencies.

### appcd-http

 * **v1.2.5** - 1/8/2020

   * chore: Updated dependencies.

### appcd-logger

 * **v2.0.5** - 1/8/2020

   * chore: Updated dependencies.

### appcd-machine-id

 * **v3.0.3** - 1/8/2020

   * chore: Updated dependencies.

### appcd-nodejs

 * **v3.0.2** - 1/8/2020

   * chore: Updated dependencies.

### appcd-path

 * **v1.1.9** - 1/8/2020

   * chore: Updated dependencies.

### appcd-plugin

 * **v3.2.2** - 1/13/2020

   * fix: Fixed bug where only streamed responses that are subscriptions should notify the child
     plugin process that the response has ended and should initiate an unsubscribe.
   * fix: Preserved error `stack` when an error is sent through the IPC tunnel from an external child
     plugin processes to the parent core process.
   * fix: Route not found errors should only be handled if the error is an instance of
     `DispatcherError`.
   * chore: Updated dependencies.

 * **v3.2.1** - 1/10/2020

   * chore: Updated dependencies.

 * **v3.2.0** - 1/8/2020

   * fix: Update plugin manager and scheme initialization to be fully synchronized so that telemetry
     is correctly enabled after initial scan.
     [(DAEMON-308)](https://jira.appcelerator.org/browse/DAEMON-308)
   * feat: Added support for an `apiVersion` in the plugin's `package.json`.
     [(DAEMON-309)](https://jira.appcelerator.org/browse/DAEMON-309)
   * chore: Updated dependencies.

### appcd-request

 * **v2.2.0** - 1/8/2020

   * feat: Add support for `HTTP_PROXY` and `HTTPS_PROXY` environment variables.
   * chore: Updated dependencies.

### appcd-response

 * **v2.0.4** - 1/13/2020

   * fix: Fixed bug where messages constructed with both a code and an error instance where using the
     error object as the message format instead of the error's message.
   * chore: Updated dependencies.

 * **v2.0.3** - 1/8/2020

   * chore: Updated dependencies.

### appcd-subprocess

 * **v3.0.2** - 1/8/2020

   * chore: Updated dependencies.

### appcd-telemetry

 * **v3.0.2** - 1/8/2020

   * chore: Updated dependencies.

### appcd-util

 * **v2.0.2** - 1/8/2020

   * chore: Updated dependencies.