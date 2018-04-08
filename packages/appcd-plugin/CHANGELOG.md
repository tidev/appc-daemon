# v1.1.0 (April 8, 2018)

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
