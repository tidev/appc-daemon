# Appc Daemon 2.2.0

## Mar 29, 2019

This is a minor release with new features, bug fixes, and dependency updates.

### Installation

```
npm i -g appcd@2.2.0
```

### appcd@2.2.0

 * fix: Fixed bug where the appcd client would exit when the connection to the server closed.
 * refactor: Updated internal `stopServer()` function to async/await.
 * chore: Updated dependencies.

### appcd-agent@1.1.5

 * chore: Updated dependencies.

### appcd-client@1.3.0

 * feat: Added `startDaemon` flag to `connect()` that will attempt to locate and start the daemon
   if it is not running.
 * chore: Updated dependencies.

### appcd-config@1.2.1

 * chore: Updated dependencies.

### appcd-config-service@1.2.1

 * chore: Updated dependencies.

### appcd-core@2.2.0

 * chore: Bumped Node.js version from 8.15.0 to 10.15.3.
 * chore: Updated dependencies.

### appcd-detect@1.3.0

 * fix: Added `paths` property to dynamically change the paths to scan and kicks off a rescan.
 * chore: Updated dependencies.

### appcd-dispatcher@1.4.0

 * fix: Fixed bug where streamed objects were not being stringified in the middleware callback.
   [(DAEMON-271)](https://jira.appcelerator.org/browse/DAEMON-271)
 * fix: Added check to ensure `ServiceDispatcher` is not directly instantiable.
 * fix: Fixed bug when dispatch handler is a `Dispatcher` or `ServiceDispatcher` and the route path
   is `/` route causing the leading `/` to get stripped off and not match the descending
   dispatcher's routes.
 * fix: When a route `path` is a regex, sets the request params to the match result instead of
   setting each param's key name to the capture group index.
 * feat: When registering a dispatcher route and the `path` is a regex, the second argument can be
   an array of key names used to name the capture groups.
 * chore: Updated dependencies.

### appcd-fs@1.1.6

 * chore: Updated dependencies.

### appcd-fswatch-manager@1.1.1

 * chore: Updated dependencies.

### appcd-fswatcher@1.2.1

 * chore: Updated dependencies.

### appcd-gulp@2.0.1

 * feat: Added cobertura reporter when running nyc.

### appcd-gulp@2.1.0

 * fix: Switched from using the Istanbul Babel plugin to letting nyc instrument the code so that
   spawned code gets covered too.
 * chore: Updated dependencies.

### appcd-http@1.2.1

 * chore: Updated dependencies.

### appcd-logger@1.1.5

 * fix: Identical release to v1.1.3 where it used snooplogg v1.x.

### appcd-logger@2.0.1

 * chore: Updated dependencies.

### appcd-machine-id@1.2.1

 * chore: Updated dependencies.

### appcd-nodejs@1.2.1

 * chore: Updated dependencies.

### appcd-path@1.1.5

 * chore: Updated dependencies.

### appcd-plugin@1.3.0

 * refactor: Reimplemented the `/` endpoint using a `DataServiceDispatcher` so that the data can be
   filtered and subscribed to. This also fixes proper 404 handling.
 * feat: Added support for plugins with scopes in their package name.
 * fix: When requesting a plugin's status by name and version, it will return that specific
   plugin's info. If there is no specific version, an array of matches is returned. If no matches,
   a 404 is returned.
 * feat: Added `appcd.fs.watch()` and `appcd.fs.unwatch()` which optimizes filesystem watching
   subscriptions.
 * chore: Updated dependencies.

### appcd-request@1.2.1

 * chore: Updated dependencies.

### appcd-response@1.1.6

 * fix: Fixed bug where exception was being thrown if locale command was not found.
 * feat: Added 'force' flag when detecting the locale.
 * chore: Updated dependencies.

### appcd-subprocess@1.3.0

 * fix: Removed broken and useless 'http' source restriction.
   [(DAEMON-272)](https://jira.appcelerator.org/browse/DAEMON-272)
 * chore: Updated dependencies.

### appcd-telemetry@1.2.1

 * chore: Updated dependencies.

### appcd-util@1.1.6

 * chore: Updated dependencies.

### appcd-winreg@1.1.5

 * chore: Updated dependencies.