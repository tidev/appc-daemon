# v3.1.0

 * feat: Added Babel config for Node 14.
 * fix: Explicitly set Node.js API warnings to >=10.
 * chore: Updated dependencies.

# v3.0.1 (Jun 12, 2020)

 * chore: Updated dependencies.

# v3.0.0 (May 1, 2020)

 * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
   [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
 * chore: Updated dependencies.

# v2.4.0 (Feb 4, 2020)

 * feat: Added optional chaining Babel plugin.
 * chore: Updated dependencies.

# v2.3.2 (Jan 13, 2020)

 * chore: Updated dependencies.

# v2.3.1 (Jan 8, 2020)

 * refactor: Moved Node version specific Babel configs into separate files.
 * chore: Updated dependencies.

# v2.3.0 (Nov 6, 2019)

 * feat: Added support for global appcd tests by setting the `APPCD_TEST_GLOBAL_PACKAGE_DIR`
   environment variable to the path of the `"packages"` directory.
 * feat: `gulp watch` now builds the project before watching files.
 * feat: Added lcov report output for coverage tests.
 * fix: Fixed `gulp watch` to continue to watch after a lint or build error occurs.
 * fix: Fixed coverage transpilation to factor in if module is the main entry point.
 * fix: Added missing fourth `options` argument to transpile `Module._resolveFilename()` override.
 * refactor: Moved `runTests()` out of standard template and into a separate `test-runner.js` file.
 * chore: Fixed homepage and repository URLs in `package.json`.
 * chore: Added links to issue trackers in readme.
 * chore: Updated dependencies.

# v2.2.0 (Aug 13, 2019)

 * feat: Added Node 12 Babel profile.
   [(DAEMON-275)](https://jira.appcelerator.org/browse/DAEMON-275)
 * chore: Updated to `eslint-config-axway@4.3.0` which added eslint 6 support and added Node.js
   eslint rules.
 * chore: Disabled `require-atomic-updates` rule.
 * chore: Removed deprecated @babel/polyfill.
 * chore: Updated dependencies.

# v2.1.1 (Jun 4, 2019)

 * fix: Added huge timeout when debugging tests.
 * chore: Updated dependencies.

# v2.1.0 (Mar 29, 2019)

 * fix: Switched from using the Istanbul Babel plugin to letting nyc instrument the code so that
   spawned code gets covered too.
 * chore: Updated dependencies.

# v2.0.1 (Mar 6, 2019)

 * feat: Added cobertura reporter when running nyc.

# v2.0.0 (Jan 16, 2019)

 * BREAKING CHANGE: Upgraded to Gulp 4.
 * chore: Added chai and promise lint rules.
 * chore: Updated dependencies.

# v1.2.1 (Nov 26, 2018)

 * chore: Updated dependencies.

# v1.2.0 (Sep 17, 2018)

 * Added a `package` template which adds `package` and `clean-package` tasks that bundle a package
   using Webpack.
 * Replaced `del.sync()` with fs-extra's `removeSync()`.
   [(DAEMON-258)](https://jira.appcelerator.org/browse/DAEMON-258)
 * Fixed bug in `test-transpile` with instrumenting coverage reporting in files that implicitly
   import the `index` file when referencing the `dist` directory.
 * Removed Babel decorators transform plugin.
 * Removed Babel minify preset.
 * Added Node 8.10 and 10.0 Babel configs.
 * Upgraded to latest Babel version.
 * Updated dependencies.

# v1.1.5 (May 24, 2018)

 * Updated dependencies:
   - mocha 5.1.1 -> 5.2.0

# v1.1.4 (May 17, 2018)

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

# v1.1.3 (May 4, 2018)

 * Fixed bug resolving nyc binary when it existed in `node_modules/.bin` rather than
   `node_modules/appcd-gulp/.bin`.
 * Fixed bug where when running `gulp coverage` dist folders under node_modules would attempt to be
   transpiled incorrectly.

# v1.1.2 (Apr 9, 2018)

 * Fixed bug where the main entry point was still referencing `pretty-log` instead of `fancy-log`.

# v1.1.1 (Apr 9, 2018)

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

# v1.1.0 (Apr 2, 2018)

 * This was a botched release and has been unpublished.

# v1.0.1 (Dec 15, 2017)

 * Updated dependencies:
   - core-js 2.5.1 -> 2.5.3
   - eslint 4.12.0 -> 4.13.1

# v1.0.0 (Dec 5, 2017)

 - Initial release.
