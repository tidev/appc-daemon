# v2.0.1

 * fix(config): Actions were not being translated correctly when dispatching request to daemon
   config service.
   [(DAEMON-269)](https://jira.appcelerator.org/browse/DAEMON-269)

# v2.0.0 (Nov 27, 2018)

 * Added `v8-compile-cache` to noticeably speed up execute.
 * Updated to latest `cli-kit`:
   - Enable `appcd` to be a proper `cli-kit` extension.
   - Added banner
   - Removed `--no-colors` since `cli-kit` now handles this for us.
 * Updated all commands to import dependencies in their action handlers instead of the top of the
   file yielding in an approximately 30% speed bump.
 * Moved all commands into a `commands` subdirectory.
 * Fixed extra `}` in user agent.
 * Fixed `appcd config ls` (and `list`) actions.
 * Removed unnecessary subscribe logic when rendering `exec` command responses.
   [(DAEMON-266)](https://jira.appcelerator.org/browse/DAEMON-266)
 * Updated dependencies.

# v1.1.3 (May 24, 2018)

 * Updated dependencies:
   - appcd-client 1.1.0 -> 1.1.1
   - appcd-config 1.1.0 -> 1.1.1
   - appcd-core 1.1.2 -> 1.1.3
   - appcd-fs 1.1.1 -> 1.1.2
   - appcd-gulp 1.1.4 -> 1.1.5
   - appcd-logger 1.1.0 -> 1.1.1
   - appcd-nodejs 1.1.0 -> 1.1.1
   - appcd-path 1.1.0 -> 1.1.1
   - appcd-util 1.1.0 -> 1.1.1

# v1.1.2 (May 17, 2018)

 * Exported the CLI definition so that `appcd` can extend `cli-kit` enabled CLI's.
   [(DAEMON-256)](https://jira.appcelerator.org/browse/DAEMON-256)
 * Updated dependencies:
   - appcd-core 1.1.0 -> 1.1.2
   - appcd-gulp 1.1.1 -> 1.1.4
   - cli-kit 0.0.12 -> 0.1.2
   - source-map-support 0.5.4 -> 0.5.6

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
