# Appc Daemon 1.1.0

## Apr 09, 2018

This is a minor release with new features, bug fixes, and dependency updates.

### Installation

```
npm i -g appcd@1.1.0
```

### appcd

 * **v1.1.0** - 4/9/2018

   * feat: Added `--view` option to `appcd dump` command which launches the dump in the
     [appcd-dump-viewer](https://github.com/appcelerator/appcd-dump-viewer).
     [(DAEMON-183)](https://jira.appcelerator.org/browse/DAEMON-183)
   * fix: Removed potentially sensitive information (hostname, environment variables) from dump file.
   * fix: Fixed order of plugins in `appcd status` output.
     [(DAEMON-216)](https://jira.appcelerator.org/browse/DAEMON-216)
   * fix: Changed `appcd exec` to return errors as stringified objects.
     [(DAEMON-248)](https://jira.appcelerator.org/browse/DAEMON-248)
   * chore: Cleaned up readme.
   * chore: Updated dependencies.

### appcd-agent

 * **v1.1.1** - 4/9/2018

   * chore: Minor code clean up.
   * chore: Improved readme.
   * chore: Updated dependencies.

### appcd-client

 * **v1.1.0** - 4/9/2018

   * chore: Added debug logging that can be viewed by setting `SNOOPLOGG=appcd:client`.
   * feat: Added support for arbitrary properties on error objects to be returned to clients from the
     daemon. [(DAEMON-248)](https://jira.appcelerator.org/browse/DAEMON-248)
   * chore: Improved readme.
   * chore: Minor code clean up.
   * chore: Updated dependencies.

### appcd-config

 * **v1.1.0** - 4/9/2018

   * chore: Improved readme.
   * chore: Updated dependencies.

### appcd-config-service

 * **v1.1.0** - 4/9/2018

   * fix: Fixed bug in the config service when returning defined, but falsey values.
   * chore: Improved readme.
   * chore: Updated dependencies.

### appcd-core

 * **v1.1.0** - 4/9/2018

   * feat: Added support for appcd plugins installed in the global `node_modules` directory.
     [(DAEMON-215)](https://jira.appcelerator.org/browse/DAEMON-215)
   * fix: Fixed bug in logcat service where errors and warnings were being written as objects instead
     of strings which was causing errors to not be rendered properly in the dump file.
     [(DAEMON-219)](https://jira.appcelerator.org/browse/DAEMON-219)
   * fix: Fixed bug with subscription streams not being closed when a socket error occurs from a
     client connection. [(DAEMON-224)](https://jira.appcelerator.org/browse/DAEMON-224)
   * chore: Bumped required version to Node.js 8.11.1 LTS.
   * fix: Fixed core process' health agent to use the poll interval from the config instead of the
     default.
   * chore: Improved readme.
   * chore: Updated dependencies.

### appcd-default-plugins

 * **v1.1.1** - 4/9/2018

   * feat: Added `appcd-plugin-titanium-sdk` plugin.
     [(DAEMON-217)](https://jira.appcelerator.org/browse/DAEMON-217)
   * refactor: Removed all appcd-* packages which were used as a workaround for a yarn workspaces limitation.
   * chore: Improved readme.

### appcd-detect

 * **v1.1.0** - 4/9/2018

   * fix: Fixed typo that caused a problem when the detect engine started scanning subdirectories.
   * chore: Improved readme.
   * chore: Updated dependencies.

### appcd-dispatcher

 * **v1.1.0** - 4/9/2018

   * fix: Fixed incorrect path reference in dispatcher preventing the request from being rerouted
     correctly.
   * fix: Fixed route invoker to always return a `DispatcherContext`. If the handler returns a value,
     it will store the value in the original context's response.
   * chore: Improved readme.
   * chore: Updated dependencies.

### appcd-fs

 * **v1.1.1** - 4/9/2018

   * chore: Minor code clean up.
   * chore: Improved readme.
   * chore: Updated dependencies

### appcd-fswatch-manager

 * **v1.0.0** - 4/9/2018

   * chore: Initial release.
   * refactor: Extracted `FSWatchManager` from
     [`appcd-fswatcher`](https://npmjs.org/package/appcd-fswatcher)

### appcd-fswatcher

 * **v1.1.0** - 4/9/2018

   * feat: Added support for handling restricted directories and files.
     [(DAEMON-233)](https://jira.appcelerator.org/browse/DAEMON-233)
     [(DAEMON-232)](https://jira.appcelerator.org/browse/DAEMON-232)
   * fix: Fixed recursively watching created or unwatch deleted directories/files.
     [(DAEMON-235)](https://jira.appcelerator.org/browse/DAEMON-235)
   * refactor: Moved the `FSWatchManager` to
     [`appcd-fswatch-manager`](https://npmjs.org/package/appcd-fswatch-manager) package.
   * chore: Improved readme.
   * chore: Updated dependencies.

### appcd-gulp

 * **v1.1.1** - 4/9/2018

   * Added support for running `test/after.js` after tests have run regardless of success.
   * Improved readme.
   * Updated dependencies:
     - babel-core 6.26.0 -> @babel/core latest
     - babel-eslint 8.0.3 -> 8.2.2
     - babel-plugin-istanbul 4.1.5 -> 4.1.6
     - babel-plugin-transform-async-to-generator 6.24.1 -> @babel/plugin-transform-async-to-generator latest
     - babel-plugin-transform-class-properties 6.24.1 -> next
     - babel-plugin-transform-es2015-destructuring 6.23.0 -> next
     - babel-plugin-transform-es2015-modules-commonjs 6.26.0 -> next
     - babel-plugin-transform-es2015-parameters 6.24.1 -> next
     - babel-plugin-transform-object-rest-spread 6.26.0 -> next
     - babel-polyfill 6.26.0 -> @babel/polyfill latest
     - babel-preset-minify 0.2.0 -> 0.4.0
     - babel-register 6.26.0 -> @babel/register latest
     - core-js 2.5.3 -> 2.5.5
     - eslint 4.13.1 -> 4.19.1
     - eslint-config-axway 2.0.7 -> 2.0.10
     - eslint-plugin-mocha 4.11.0 -> 5.0.0
     - gulp-babel 7.0.0 -> next
     - gulp-debug 3.1.0 -> 3.2.0
     - gulp-eslint 4.0.0 -> 4.0.2
     - gulp-plumber 1.1.0 -> 1.2.0
     - mocha 4.0.1 -> 5.0.5
     - mocha-jenkins-reporter 0.3.10 -> 0.3.12
     - nyc 11.3.0 -> 11.6.0
     - sinon 4.1.2 -> 4.5.0
     - sinon-chai 2.14.0 -> 3.0.0

### appcd-http

 * **v1.1.0** - 4/9/2018

   * fix: Added logging for socket related errors.
     [(DAEMON-224)](https://jira.appcelerator.org/browse/DAEMON-224)
   * chore: Improved readme.
   * chore: Updated dependencies.

### appcd-logger

 * **v1.1.0** - 4/9/2018

   * chore: Improved readme.
   * chore: Updated dependencies.

### appcd-machine-id

 * **v1.1.0** - 4/9/2018

   * chore: Improved readme.
   * chore: Updated dependencies.

### appcd-nodejs

 * **v1.1.0** - 4/9/2018

   * feat: Added support for purging Node.js executables that haven't been used for more than 90
     days. [(DAEMON-244)](https://jira.appcelerator.org/browse/DAEMON-244)
   * refactor: Moved `APPCD_NETWORK_CA_FILE`, `APPCD_NETWORK_PROXY`, and `APPCD_NETWORK_STRICT_SSL`
     environment variables to [`appcd-request`](https://npmjs.org/package/appcd-request).
   * chore: Improved readme.
   * chore: Updated dependencies.

### appcd-path

 * **v1.1.0** - 4/9/2018

   * chore: Improved readme.
   * chore: Updated dependencies.

### appcd-plugin

 * **v1.1.0** - 4/9/2018

   * feat: Enforce appcd version compatible check when loading a plugin.
     [(DAEMON-208)](https://jira.appcelerator.org/browse/DAEMON-208)
   * feat: Automatically injecting the built-in `appcd-*` packages when required from the plugin when
     plugin `injectAppcdDependencies` property is not `false`.
   * fix: Deprecated `appcd-plugin` property in plugin `packages.json` in favor of `appcd` property.
   * fix: Plugin should fail to load if `appcd` section in `packages.json` is not an object.
     [(DAEMON-213)](https://jira.appcelerator.org/browse/DAEMON-213)
   * feat: Added support for plugin to define wildcard paths to ignore and not unload the plugin when
     a file is changed. [(DAEMON-222)](https://jira.appcelerator.org/browse/DAEMON-222) and
     [(DAEMON-236)](https://jira.appcelerator.org/browse/DAEMON-236)
   * feat: Added support for loading appcd plugins that are published as scoped packages.
     [(DAEMON-220)](https://jira.appcelerator.org/browse/DAEMON-220)
   * fix: Fix bug where plugin scheme detection was preventing the daemon from shutting down.
     [(DAEMON-239)](https://jira.appcelerator.org/browse/DAEMON-239)
   * feat: Plugin host is spawned with the current working directory set to the plugin path.
     [(DAEMON-234)](https://jira.appcelerator.org/browse/DAEMON-234)
   * fix: Suppressed noisy warnings for packages that are not valid appcd plugins.
     [(DAEMON-223)](https://jira.appcelerator.org/browse/DAEMON-223)
   * chore: Improved `appcd-plugin-host` process title to include plugin name, version, and path.
   * chore: Improved readme.
   * chore: Updated dependencies.

### appcd-request

 * **v1.1.0** - 4/9/2018

   * chore: Improved readme.
   * chore: Updated dependencies.

### appcd-response

 * **v1.1.0** - 4/9/2018

   * chore: Improved readme.
   * chore: Updated dependencies.

### appcd-subprocess

 * **v1.1.0** - 4/9/2018

   * chore: Improved readme.
   * chore: Updated dependencies.

### appcd-telemetry

 * **v1.1.0** - 4/9/2018

   * fix: Fixed environemnt and deploy type for telemetry events.
     [(DAEMON-241)](https://jira.appcelerator.org/browse/DAEMON-241)
   * chore: Improved readme.
   * chore: Updated dependencies:

### appcd-util

 * **v1.1.0** - 4/9/2018

   * feat: Added ability to cancel a pending `debounce()`.
     [(DAEMON-238)](https://jira.appcelerator.org/browse/DAEMON-238)
   * chore: Improved readme.
   * chore: Updated dependencies.

### appcd-winreg

 * **v1.1.0** - 4/9/2018

   * chore: Improved readme.
   * chore: Updated dependencies.