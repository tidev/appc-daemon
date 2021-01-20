# Appc Daemon 1.1.2

## May 17, 2018

This is a patch release with bug fixes and minor dependency updates.

### Installation

```
npm i -g appcd@1.1.2
```

### appcd

 * **v1.1.2** - 5/17/2018

   * feat: Exported the CLI definition so that `appcd` can extend `cli-kit` enabled CLI's.
     [(DAEMON-256)](https://jira.appcelerator.org/browse/DAEMON-256)
   * chore: Updated dependencies.

### appcd-core

 * **v1.1.2** - 5/17/2018

   * chore: Updated dependencies.

 * **v1.1.1** - 4/11/2018

   * fix: Ensure that all WebSocket responses have a status and a (string) statusCode.

### appcd-default-plugins

 * **v1.1.2** - 4/11/2018

   * chore: Updated dependencies.

### appcd-gulp

 * **v1.1.4** - 5/17/2018

   * Fixed regression with resolving mocha on Windows.
   * Module filename resolver now resolves parent id before testing if file is a dist file. This is a
     precautionary measure.
   * Updated sinon sandbox creation to avoid deprecated API.
   * Updated dependencies:
     - ansi-colors 1.1.0 -> 2.0.1
     - babel-eslint 8.2.2 -> 8.2.3
     - babel-preset-minify 0.4.0 -> 0.4.3
     - core-js 2.5.5 -> 2.5.6
     - esdoc 1.0.4 -> 1.1.0
     - esling-config-axway 2.0.10 -> 2.0.14
     - mocha 5.0.5 -> 5.1.1
     - nyc 11.6.0 -> 11.8.0
     - sinon 4.5.0 -> 5.0.7

 * **v1.1.3** - 5/4/2018

   * Fixed bug resolving nyc binary when it existed in `node_modules/.bin` rather than
     `node_modules/appcd-gulp/.bin`.
   * Fixed bug where when running `gulp coverage` dist folders under node_modules would attempt to be
     transpiled incorrectly.

### appcd-plugin

 * **v1.1.1** - 4/11/2018

   * fix: Reset the plugin's `stack` message when the plugin is stopped.
   * fix: Fixed error handling when a plugin fails to activate or deactivate.
   * feat: Added `/appcd/plugin/status/:name?/:version?` service to get a plugin's status without
     invoking the plugin.