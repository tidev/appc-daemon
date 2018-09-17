# v1.1.3

 * Fixed plugin telemetry so that it doesn't send events during the initial scan or shutdown.
 * Fixed lint issue with code indention.
 * Updated dependencies.

# v1.1.2 (May 24, 2018)

 * Updated dependencies:
   - appcd-agent 1.1.1 -> 1.1.2
   - appcd-client 1.1.0 -> 1.1.1
   - appcd-config 1.1.0 -> 1.1.1
   - appcd-config-service 1.1.0 -> 1.1.1
   - appcd-detect 1.1.0 -> 1.1.1
   - appcd-dispatcher 1.1.0 -> 1.1.1
   - appcd-fs 1.1.1 -> 1.1.2
   - appcd-fswatch-manager 1.0.0 -> 1.0.1
   - appcd-fswatcher 1.1.0 -> 1.1.1
   - appcd-gulp 1.1.1 -> 1.1.5
   - appcd-http 1.1.0 -> 1.1.1
   - appcd-logger 1.1.0 -> 1.1.1
   - appcd-machine-id 1.1.0 -> 1.1.1
   - appcd-nodejs 1.1.0 -> 1.1.1
   - appcd-path 1.1.0 -> 1.1.1
   - appcd-request 1.1.0 -> 1.1.1
   - appcd-response 1.1.0 -> 1.1.2
   - appcd-subprocess 1.1.0 -> 1.1.1
   - appcd-telemetry 1.1.0 -> 1.1.1
   - appcd-util 1.1.0 -> 1.1.1
   - appcd-winreg 1.1.0 -> 1.1.1
   - fs-extra 5.0.0 -> 6.0.1
   - ignore 3.3.7 -> 3.3.8
   - source-map-support 0.5.4 -> 0.5.6

# v1.1.1 (Apr 11, 2018)

 * Reset the plugin's `stack` message when the plugin is stopped.
 * Fixed error handling when a plugin fails to activate or deactivate.
 * Added `/appcd/plugin/status/:name?/:version?` service to get a plugin's status without invoking
   the plugin.

# v1.1.0 (Apr 9, 2018)

 * Enforce appcd version compatible check when loading a plugin.
   [(DAEMON-208)](https://jira.appcelerator.org/browse/DAEMON-208)
 * Automatically injecting the built-in `appcd-*` packages when required from the plugin when
   plugin `injectAppcdDependencies` property is not `false`.
 * Deprecated `appcd-plugin` property in plugin `packages.json` in favor of `appcd` property.
 * Plugin should fail to load if `appcd` section in `packages.json` is not an object.
   [(DAEMON-213)](https://jira.appcelerator.org/browse/DAEMON-213)
 * Added support for plugin to define wildcard paths to ignore and not unload the plugin when a
   file is changed. [(DAEMON-222)](https://jira.appcelerator.org/browse/DAEMON-222) and
   [(DAEMON-236)](https://jira.appcelerator.org/browse/DAEMON-236)
 * Added support for loading appcd plugins that are published as scoped packages.
   [(DAEMON-220)](https://jira.appcelerator.org/browse/DAEMON-220)
 * Fix bug where plugin scheme detection was preventing the daemon from shutting down.
   [(DAEMON-239)](https://jira.appcelerator.org/browse/DAEMON-239)
 * Plugin host is spawned with the current working directory set to the plugin path.
   [(DAEMON-234)](https://jira.appcelerator.org/browse/DAEMON-234)
 * Suppressed noisy warnings for packages that are not valid appcd plugins.
   [(DAEMON-223)](https://jira.appcelerator.org/browse/DAEMON-223)
 * Improved `appcd-plugin-host` process title to include plugin name, version, and path.
 * Improved readme.
 * Updated dependencies:
   - appcd-agent 1.0.1 -> 1.1.1
   - appcd-config 1.0.1 -> 1.1.0
   - appcd-config-service 1.0.1 -> 1.1.0
   - appcd-dispatcher 1.0.1 -> 1.1.0
   - appcd-fs 1.0.1 -> 1.1.1
   - appcd-fswatcher 1.0.1 -> 1.1.0
   - appcd-gulp 1.0.1 -> 1.1.1
   - appcd-logger 1.0.1 -> 1.1.0
   - appcd-path 1.0.1 -> 1.1.0
   - appcd-response 1.0.1 -> 1.1.0
   - appcd-subprocess 1.0.1 -> 1.1.0
   - appcd-util 1.0.1 -> 1.1.0
   - gawk 4.4.4 -> 4.4.5
   - semver 5.4.1 -> 5.5.0
   - source-map-support 0.5.0 -> 0.5.4
   - uuid 3.1.0 -> 3.2.1

# v1.0.1 (Dec 15, 2017)

 * Updated dependencies:
   - appcd-agent 1.0.0 -> 1.0.1
   - appcd-config 1.0.0 -> 1.0.1
   - appcd-config-service 1.0.0 -> 1.0.1
   - appcd-dispatcher 1.0.0 -> 1.0.1
   - appcd-fs 1.0.0 -> 1.0.1
   - appcd-fswatcher 1.0.0 -> 1.0.1
   - appcd-gulp 1.0.0 -> 1.0.1
   - appcd-logger 1.0.0 -> 1.0.1
   - appcd-path 1.0.0 -> 1.0.1
   - appcd-response 1.0.0 -> 1.0.1
   - appcd-subprocess 1.0.0 -> 1.0.1
   - appcd-util 1.0.0 -> 1.0.1
   - fs-extra 4.0.2 -> 5.0.0

# v1.0.0 (Dec 5, 2017)

 - Initial release.
