# Appc Daemon 1.1.2

## May 17, 2018

This is a patch release with bug fixes and minor dependency updates.

### Installation

```
npm i -g appcd@1.1.2
```

### appcd@1.1.2

 * feat: Exported the CLI definition so that `appcd` can extend `cli-kit` enabled CLI's.
   [(DAEMON-256)](https://jira.appcelerator.org/browse/DAEMON-256)
 * chore: Updated dependencies.

### appcd-core@1.1.1

 * fix: Ensure that all WebSocket responses have a status and a (string) statusCode.

### appcd-core@1.1.2

 * chore: Updated dependencies.

### appcd-default-plugins@1.1.2

 * chore: Updated dependencies.

### appcd-gulp@1.1.3

 * Fixed bug resolving nyc binary when it existed in `node_modules/.bin` rather than
   `node_modules/appcd-gulp/.bin`.
 * Fixed bug where when running `gulp coverage` dist folders under node_modules would attempt to be
   transpiled incorrectly.

### appcd-gulp@1.1.4

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

### appcd-plugin@1.1.1

 * fix: Reset the plugin's `stack` message when the plugin is stopped.
 * fix: Fixed error handling when a plugin fails to activate or deactivate.
 * feat: Added `/appcd/plugin/status/:name?/:version?` service to get a plugin's status without
   invoking the plugin.