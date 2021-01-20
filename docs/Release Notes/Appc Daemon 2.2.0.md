# Appc Daemon 2.2.0

## Mar 29, 2019

This is a minor release with new features, bug fixes, and dependency updates.

### Installation

```
npm i -g appcd@2.2.0
```

### appcd

 * **v2.2.0** - 3/29/2019

   * fix: Fixed bug where the appcd client would exit when the connection to the server closed.
   * refactor: Updated internal `stopServer()` function to async/await.
   * chore: Updated dependencies.

### appcd-agent

 * **v1.1.5** - 3/29/2019

   * chore: Updated dependencies.

### appcd-client

 * **v1.3.0** - 3/29/2019

   * feat: Added `startDaemon` flag to `connect()` that will attempt to locate and start the daemon
     if it is not running.
   * chore: Updated dependencies.

### appcd-config

 * **v1.2.1** - 3/29/2019

   * chore: Updated dependencies.

### appcd-config-service

 * **v1.2.1** - 3/29/2019

   * chore: Updated dependencies.

### appcd-core

 * **v2.2.0** - 3/29/2019

   * chore: Bumped Node.js version from 8.15.0 to 10.15.3.
   * chore: Updated dependencies.

### appcd-detect

 * **v1.3.0** - 3/29/2019

   * fix: Added `paths` property to dynamically change the paths to scan and kicks off a rescan.
   * chore: Updated dependencies.

### appcd-dispatcher

 * **v1.4.0** - 3/29/2019

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

### appcd-fs

 * **v1.1.6** - 3/29/2019

   * chore: Updated dependencies.

### appcd-fswatch-manager

 * **v1.1.1** - 3/29/2019

   * chore: Updated dependencies.

### appcd-fswatcher

 * **v1.2.1** - 3/29/2019

   * chore: Updated dependencies.

### appcd-gulp

 * **v2.1.0** - 3/29/2019

   * fix: Switched from using the Istanbul Babel plugin to letting nyc instrument the code so that
     spawned code gets covered too.
   * chore: Updated dependencies.

 * **v2.0.1** - 3/6/2019

   * feat: Added cobertura reporter when running nyc.

### appcd-http

 * **v1.2.1** - 3/29/2019

   * chore: Updated dependencies.

### appcd-logger

 * **v2.0.1** - 3/29/2019

   * chore: Updated dependencies.

 * **v1.1.5** - 1/24/2019

   * fix: Identical release to v1.1.3 where it used snooplogg v1.x.

### appcd-machine-id

 * **v1.2.1** - 3/29/2019

   * chore: Updated dependencies.

### appcd-nodejs

 * **v1.2.1** - 3/29/2019

   * chore: Updated dependencies.

### appcd-path

 * **v1.1.5** - 3/29/2019

   * chore: Updated dependencies.

### appcd-plugin

 * **v1.3.0** - 3/29/2019

   * refactor: Reimplemented the `/` endpoint using a `DataServiceDispatcher` so that the data can be
     filtered and subscribed to. This also fixes proper 404 handling.
   * feat: Added support for plugins with scopes in their package name.
   * fix: When requesting a plugin's status by name and version, it will return that specific
     plugin's info. If there is no specific version, an array of matches is returned. If no matches,
     a 404 is returned.
   * feat: Added `appcd.fs.watch()` and `appcd.fs.unwatch()` which optimizes filesystem watching
     subscriptions.
   * chore: Updated dependencies.

### appcd-request

 * **v1.2.1** - 3/29/2019

   * chore: Updated dependencies.

### appcd-response

 * **v1.1.6** - 3/29/2019

   * fix: Fixed bug where exception was being thrown if locale command was not found.
   * feat: Added 'force' flag when detecting the locale.
   * chore: Updated dependencies.

### appcd-subprocess

 * **v1.3.0** - 3/29/2019

   * fix: Removed broken and useless 'http' source restriction.
     [(DAEMON-272)](https://jira.appcelerator.org/browse/DAEMON-272)
   * chore: Updated dependencies.

### appcd-telemetry

 * **v1.2.1** - 3/29/2019

   * chore: Updated dependencies.

### appcd-util

 * **v1.1.6** - 3/29/2019

   * chore: Updated dependencies.

### appcd-winreg

 * **v1.1.5** - 3/29/2019

   * chore: Updated dependencies.