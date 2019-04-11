# v1.2.2

 * Removed dependency on `tmp` package so that its SIGINT handler doesn't force exit the program.
 * Updated dependencies.

# v1.2.1 (Mar 29, 2019)

 * Updated dependencies.

# v1.2.0 (Jan 24, 2019)

 * Upgraded to appcd-logger@2.0.0.

# v1.1.4 (Jan 16, 2019)

 * Added pluralize dependency since it was removed from snooplogg 2.
 * Refactored promises to async/await.
 * Updated dependencies.

# v1.1.3 (Nov 27, 2018)

 * Updated dependencies.

# v1.1.2 (Sep 17, 2018)

 * Updated dependencies.

# v1.1.1 (May 24, 2018)

 * Updated dependencies:
   - appcd-fs 1.1.1 -> 1.1.2
   - appcd-gulp 1.1.1 -> 1.1.5
   - appcd-logger 1.1.0 -> 1.1.1
   - appcd-request 1.1.0 -> 1.1.1
   - appcd-util 1.1.0 -> 1.1.1
   - fs-extra 5.0.0 -> 6.0.1
   - source-map-support 0.5.4 -> 0.5.6
   - tar-stream 1.5.5 -> 1.6.1

# v1.1.0 (Apr 9, 2018)

 * Added support for purging Node.js executables that haven't been used for more than 90 days.
   [(DAEMON-244)](https://jira.appcelerator.org/browse/DAEMON-244)
 * Moved `APPCD_NETWORK_CA_FILE`, `APPCD_NETWORK_PROXY`, and `APPCD_NETWORK_STRICT_SSL`
   environment variables to [`appcd-request`](https://npmjs.org/package/appcd-request).
 * Improved readme.
 * Updated dependencies:
   - appcd-fs 1.0.1 -> 1.1.1
   - appcd-gulp 1.0.1 -> 1.1.1
   - appcd-logger 1.0.1 -> 1.1.0
   - appcd-request 1.0.1 -> 1.1.0
   - appcd-util 1.0.1 -> 1.1.0
   - source-map-support 0.5.0 -> 0.5.4

# v1.0.1 (Dec 15, 2017)

 * Updated dependencies:
   - appcd-fs 1.0.0 -> 1.0.1
   - appcd-gulp 1.0.0 -> 1.0.1
   - appcd-logger 1.0.0 -> 1.0.1
   - appcd-request 1.0.0 -> 1.0.1
   - appcd-util 1.0.0 -> 1.0.1
   - fs-extra 4.0.2 -> 5.0.0

# v1.0.0 (Dec 5, 2017)

 - Initial release.
