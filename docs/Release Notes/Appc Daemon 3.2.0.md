# Appc Daemon 3.2.0

## Jan 13, 2020

This is a minor release with new features, bug fixes, and dependency updates.

### Installation

```
npm i -g appcd@3.2.0
```

### appcd@3.2.0

 * fix: Fixed `--config` and `--config-file` format to require a value.
 * chore: Updated dependencies.

### appcd-agent@1.1.9

 * chore: Updated dependencies.

### appcd-client@2.0.3

 * chore: Updated dependencies.

### appcd-client@2.0.4

 * fix: Fixed bug where chunked responses that didn't contain a status were treated as 500 errors
   and the client would disconnect.
 * chore: Updated dependencies.

### appcd-config@2.0.1

 * chore: Updated dependencies.

### appcd-config@2.0.2

 * chore: Updated dependencies.

### appcd-config-service@2.0.3

 * chore: Updated dependencies.

### appcd-core@3.2.0

 * fix: Fixed `--config` and `--config-file` format to require a value.
 * fix: Await `PluginManager` to initialize.
   [(DAEMON-308)](https://jira.appcelerator.org/browse/DAEMON-308)
 * fix: Removed `status` and `statusCode` from subsequent non-pubsub chunked responses.
 * chore: Updated dependencies.

### appcd-default-plugins@4.2.0

 * fix: Gracefully handle error when yarn links directory exists, but access is denied.
   [(DAEMON-307)](https://jira.appcelerator.org/browse/DAEMON-307)
 * chore: Added latest versions of the plugins.
 * chore: Fixed homepage and repository URLs in `package.json`.
 * chore: Added links to issue trackers in readme.
 * chore: Updated dependencies.

### appcd-detect@2.2.2

 * chore: Updated dependencies.

### appcd-detect@2.2.3

 * fix: Only use a single recursive file watcher instead of watching each found path when recursive
   and redetect flags are set.

### appcd-dispatcher@2.0.3

 * chore: Updated dependencies.

### appcd-fs@1.1.10

 * chore: Updated dependencies.

### appcd-fswatch-manager@2.0.3

 * chore: Updated dependencies.

### appcd-fswatcher@1.2.5

 * chore: Updated dependencies.

### appcd-gulp@2.3.1

 * refactor: Moved Node version specific Babel configs into separate files.
 * chore: Updated dependencies.

### appcd-gulp@2.3.2

 * chore: Updated dependencies.

### appcd-http@1.2.5

 * chore: Updated dependencies.

### appcd-logger@2.0.5

 * chore: Updated dependencies.

### appcd-machine-id@3.0.3

 * chore: Updated dependencies.

### appcd-nodejs@3.0.2

 * chore: Updated dependencies.

### appcd-path@1.1.9

 * chore: Updated dependencies.

### appcd-plugin@3.2.0

 * fix: Update plugin manager and scheme initialization to be fully synchronized so that telemetry
   is correctly enabled after initial scan.
   [(DAEMON-308)](https://jira.appcelerator.org/browse/DAEMON-308)
 * feat: Added support for an `apiVersion` in the plugin's `package.json`.
   [(DAEMON-309)](https://jira.appcelerator.org/browse/DAEMON-309)
 * chore: Updated dependencies.

### appcd-plugin@3.2.1

 * chore: Updated dependencies.

### appcd-plugin@3.2.2

 * fix: Fixed bug where only streamed responses that are subscriptions should notify the child
   plugin process that the response has ended and should initiate an unsubscribe.
 * fix: Preserved error `stack` when an error is sent through the IPC tunnel from an external child
   plugin processes to the parent core process.
 * fix: Route not found errors should only be handled if the error is an instance of
   `DispatcherError`.
 * chore: Updated dependencies.

### appcd-request@2.2.0

 * feat: Add support for `HTTP_PROXY` and `HTTPS_PROXY` environment variables.
 * chore: Updated dependencies.

### appcd-response@2.0.3

 * chore: Updated dependencies.

### appcd-response@2.0.4

 * fix: Fixed bug where messages constructed with both a code and an error instance where using the
   error object as the message format instead of the error's message.
 * chore: Updated dependencies.

### appcd-subprocess@3.0.2

 * chore: Updated dependencies.

### appcd-telemetry@3.0.2

 * chore: Updated dependencies.

### appcd-util@2.0.2

 * chore: Updated dependencies.