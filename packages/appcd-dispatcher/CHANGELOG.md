# v2.0.1 (Aug 13, 2019)

 * chore: Fixed eslint `hasOwnProperty` warnings.
 * chore: Updated dependencies.

# v2.0.0 (Jun 13, 2019)

 * BREAKING CHANGE: Updated to `appcd-response@2.0.0`.

# v1.4.2 (Jun 13, 2019)

 * chore: Republish of v1.4.0.

# v1.4.1 (Jun 4, 2019)

 * chore: Updated dependencies.

# v1.4.0 (Mar 29, 2019)

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

# v1.3.0 (Jan 24, 2019)

 * chore: Upgraded to appcd-logger@2.0.0.

# v1.2.2 (Jan 16, 2019)

 * fix: Added pluralize dependency since it was removed from snooplogg 2.
 * refactor: Refactored promises to async/await.
 * chore: Updated dependencies.

# v1.2.1 (Nov 27, 2018)

 * chore: Updated dependencies.

# v1.2.0 (Sep 17, 2018)

 * fix: Removed support for period delimited filters in `DataServiceDispatcher`.
 * feat: Added `startTime`, `status`, and `time` to `DispatcherContext`.
 * refactor: Cleaned up Koa middleware callback and added a `onRequest` callback for telemetry.
 * fix: Fixed bug where `Dispatcher.call()` throws an error instead of returning a rejected promise.
 * chore: Updated dependencies.

# v1.1.1 (May 24, 2018)

 * chore: Updated dependencies.

# v1.1.0 (Apr 9, 2018)

 * fix: Fixed incorrect path reference in dispatcher preventing the request from being rerouted
   correctly.
 * fix: Fixed route invoker to always return a `DispatcherContext`. If the handler returns a value,
   it will store the value in the original context's response.
 * chore: Improved readme.
 * chore: Updated dependencies.

# v1.0.1 (Dec 15, 2017)

 * chore: Updated dependencies.

# v1.0.0 (Dec 5, 2017)

 - Initial release.
