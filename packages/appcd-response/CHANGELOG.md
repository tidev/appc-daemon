# v2.0.4 (Jan 13, 2020)

 * fix: Fixed bug where messages constructed with both a code and an error instance where using the
   error object as the message format instead of the error's message.
 * chore: Updated dependencies.

# v2.0.3 (Jan 8, 2020)

 * chore: Updated dependencies.

# v2.0.2 (Nov 6, 2019)

 * fix(locale): Removed dependency on `winreglib` for detecting the locale on Windows in favor of
   spawning the Windows Registry `reg.exe` command.
   [(DAEMON-287)](https://jira.appcelerator.org/browse/DAEMON-287)
 * chore: Fixed homepage and repository URLs in `package.json`.
 * chore: Added links to issue trackers in readme.
 * chore: Updated dependencies.

# v2.0.1 (Aug 13, 2019)

 * chore: Fixed eslint `hasOwnProperty` warnings.
 * chore: Updated dependencies.

# v2.0.0 (Jun 4, 2019)

 * BREAKING CHANGE: Bumped minimum required Node.js version to v8.12.0.
 * feat: Replaced `appcd-winreg` with `winreglib`.
   [(DAEMON-276)](https://jira.appcelerator.org/browse/DAEMON-276)
 * chore: Updated dependencies.

# v1.1.6 (Mar 29, 2019)

 * fix: Fixed bug where exception was being thrown if locale command was not found.
 * feat: Added 'force' flag when detecting the locale.
 * chore: Updated dependencies.

# v1.1.5 (Jan 16, 2019)

 * chore: Updated dependencies.

# v1.1.4 (Nov 27, 2018)

 * chore: Updated dependencies.

# v1.1.3 (Sep 17, 2018)

 * fix: Telemetry payload changed:
   - Added `app_version`, `os`, `osver`, `platform`
   - Fixed `deploytype`, `ts`, `ver`
   - Removed `params`
 * feat: Added support for `ti.start` and `ti.end`.
 * refactor: Refactored sending events to support flushing all events.
 * chore: Updated dependencies.

# v1.1.2 (May 24, 2018)

 * chore: Updated dependencies.

# v1.1.1 (Apr 10, 2018)

 * feat: Added response code 501 Not Implemented.

# v1.1.0 (Apr 9, 2018)

 * chore: Improved readme.
 * chore: Updated dependencies.

# v1.0.1 (Dec 15, 2017)

 * chore: Updated dependencies.

# v1.0.0 (Dec 5, 2017)

 - Initial release.
