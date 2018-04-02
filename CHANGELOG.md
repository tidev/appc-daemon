# v1.1.0 (April 2, 2018)

 * appcd
   - Added `--view` option to `appcd dump` command which launches the dump in the
     [appcd-dump-viewer](https://github.com/appcelerator/appcd-dump-viewer).
     [(DAEMON-183)](https://jira.appcelerator.org/browse/DAEMON-183)
   - Removed potentially sensitive information (hostname, environment variables) from dump file.
   - Fixed order of plugins in `appcd status` output.
     [(DAEMON-216)](https://jira.appcelerator.org/browse/DAEMON-216)
   - Changed `appcd exec` to return errors as stringified objects.
     [(DAEMON-248)](https://jira.appcelerator.org/browse/DAEMON-248)
 * appcd-client
   - Added debug logging that can be viewed by setting `SNOOPLOGG=appcd:client`.
   - Added support for arbitrary properties on error objects to be returned to clients from the
     daemon.
     [(DAEMON-248)](https://jira.appcelerator.org/browse/DAEMON-248)
 * appcd-config-service
   - Fixed bug in the config service when returning defined, but falsey values.
 * appcd-core
   - Added support for appcd plugins installed in the global `node_modules` directory.
     [(DAEMON-215)](https://jira.appcelerator.org/browse/DAEMON-215)
   - Fixed bug in logcat service where errors and warnings were being written as objects instead of
     strings which was causing errors to not be rendered properly in the dump file.
	 [(DAEMON-219)](https://jira.appcelerator.org/browse/DAEMON-219)
   - Fixed bug with subscription streams not being closed when a socket error occurs from a client
     connection. [(DAEMON-224)](https://jira.appcelerator.org/browse/DAEMON-224)
   - Bumped required version to Node.js 8.11.1 LTS.
   - Fixed core process' health agent to use the poll interval from the config instead of the
     default.
 * appcd-default-plugins
   - Added `appcd-plugin-titanium-sdk` plugin.
     [(DAEMON-217)](https://jira.appcelerator.org/browse/DAEMON-217)
 * appcd-dispatcher
   - Fixed incorrect path reference in dispatcher preventing the request from being rerouted
     correctly.
 * appcd-detect
   - Fixed typo that caused a problem when the detect engine started scanning subdirectories.
 * appcd-fswatcher
   - Added support for handling restricted directories and files.
     [(DAEMON-233)](https://jira.appcelerator.org/browse/DAEMON-233)
	 [(DAEMON-232)](https://jira.appcelerator.org/browse/DAEMON-232)
   - Fixed recursively watching created or unwatch deleted directories/files.
     [(DAEMON-235)](https://jira.appcelerator.org/browse/DAEMON-235)
 * appcd-gulp
   - Added support for running `test/after.js` after tests have run regardless of success.
 * appcd-http
   - Added logging for socket related errors.
     [(DAEMON-224)](https://jira.appcelerator.org/browse/DAEMON-224)
 * appcd-nodejs
   - Added support for purging Node.js executables that haven't been used for more than 90 days.
     [(DAEMON-244)](https://jira.appcelerator.org/browse/DAEMON-244)
   - Moved `APPCD_NETWORK_CA_FILE`, `APPCD_NETWORK_PROXY`, and `APPCD_NETWORK_STRICT_SSL`
     environment variables to `appcd-request`.
 * appcd-plugin
   - Enforce appcd version compatible check when loading a plugin.
     [(DAEMON-208)](https://jira.appcelerator.org/browse/DAEMON-208)
   - Automatically injecting the built-in `appcd-*` packages when required from the plugin when
     plugin `injectAppcdDependencies` property is not `false`.
   - Deprecated `appcd-plugin` property in plugin `packages.json` in favor of `appcd` property.
   - Plugin should fail to load if `appcd` section in `packages.json` is not an object.
     [(DAEMON-213)](https://jira.appcelerator.org/browse/DAEMON-213)
   - Added support for plugin to define wildcard paths to ignore and not unload the plugin when a
     file is changed. [(DAEMON-222)](https://jira.appcelerator.org/browse/DAEMON-222) and
	 [(DAEMON-236)](https://jira.appcelerator.org/browse/DAEMON-236)
   - Added support for loading appcd plugins that are published as scoped packages.
     [(DAEMON-220)](https://jira.appcelerator.org/browse/DAEMON-220)
   - Fix bug where plugin scheme detection was preventing the daemon from shutting down.
     [(DAEMON-239)](https://jira.appcelerator.org/browse/DAEMON-239)
   - Plugin host is spawned with the current working directory set to the plugin path.
     [(DAEMON-234)](https://jira.appcelerator.org/browse/DAEMON-234)
   - Suppressed noisy warnings for packages that are not valid appcd plugins.
     [(DAEMON-223)](https://jira.appcelerator.org/browse/DAEMON-223)
   - Improved `appcd-plugin-host` process title to include plugin name, version, and path.
 * appcd-telemetry
   - Fixed environemnt and deploy type for telemetry events.
     [(DAEMON-241)](https://jira.appcelerator.org/browse/DAEMON-241)
 * appcd-util
   - Added ability to cancel a pending `debounce()`.
     [(DAEMON-238)](https://jira.appcelerator.org/browse/DAEMON-238)

# v1.0.1 (Dec 15, 2017)

 * appcd
   - Fixed bug where restarting the daemon didn't wait for it to gracefully shutdown.
     [(DAEMON-207)](https://jira.appcelerator.org/browse/DAEMON-207)
 * appcd-client
   - Only set `Accept-Language` if locale is `null`.
     [(DAEMON-201)](https://jira.appcelerator.org/browse/DAEMON-201)

# v1.0.0 (Dec 5, 2017)

 - Initial release.
