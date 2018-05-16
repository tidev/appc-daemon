# Unreleased

 * Exported the CLI definition so that `appcd` can extend `cli-kit` enabled CLI's.
   [(DAEMON-256)](https://jira.appcelerator.org/browse/DAEMON-256)

# v1.1.1 (Apr 10, 2018)

 * Changed `exec` command to return full JSON response instead of just the message.

# v1.1.0 (Apr 9, 2018)

 * Added `--view` option to `appcd dump` command which launches the dump in the
   [appcd-dump-viewer](https://github.com/appcelerator/appcd-dump-viewer).
   [(DAEMON-183)](https://jira.appcelerator.org/browse/DAEMON-183)
 * Removed potentially sensitive information (hostname, environment variables) from dump file.
 * Fixed order of plugins in `appcd status` output.
   [(DAEMON-216)](https://jira.appcelerator.org/browse/DAEMON-216)
 * Changed `appcd exec` to return errors as stringified objects.
   [(DAEMON-248)](https://jira.appcelerator.org/browse/DAEMON-248)
 * Cleaned up readme.
 * Updated dependencies:
   - appcd-client 1.0.1 -> 1.1.0
   - appcd-config 1.0.1 -> 1.1.0
   - appcd-core 1.0.1 -> 1.1.0
   - appcd-fs 1.0.1 -> 1.1.0
   - appcd-gulp 1.0.1 -> 1.1.1
   - appcd-logger 1.0.1 -> 1.1.0
   - appcd-nodejs 1.0.1 -> 1.1.0
   - appcd-path 1.0.1 -> 1.1.0
   - appcd-util 1.0.1 -> 1.1.0
   - cli-kit 0.0.9 -> 0.0.12
   - source-map-support 0.5.0 -> 0.5.4

# v1.0.1 (Dec 15, 2017)

 * Fixed bug where restarting the daemon didn't wait for it to gracefully shutdown.
   [(DAEMON-207)](https://jira.appcelerator.org/browse/DAEMON-207)
 * Updated dependencies:
   - appcd-client 1.0.0 -> 1.0.1
   - appcd-config 1.0.0 -> 1.0.1
   - appcd-core 1.0.0 -> 1.0.1
   - appcd-fs 1.0.0 -> 1.0.1
   - appcd-gulp 1.0.0 -> 1.0.1
   - appcd-logger 1.0.0 -> 1.0.1
   - appcd-nodejs 1.0.0 -> 1.0.1
   - appcd-path 1.0.0 -> 1.0.1
   - appcd-util 1.0.0 -> 1.0.1

# v1.0.0 (Dec 5, 2017)

 - Initial release.
