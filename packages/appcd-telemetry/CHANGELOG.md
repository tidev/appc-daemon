# v5.0.5

 * chore: Updated dependencies.

# v5.0.4 (Mar 3, 2021)

 * chore: Updated dependencies.

# v5.0.3 (Jan 26, 2021)

 * chore: Updated dependencies.

# v5.0.2 (Jan 22, 2021)

 * chore: Updated dependencies.

# v5.0.1 (Jan 5, 2021)

 * chore: Updated dependencies.

# v5.0.0 (Dec 1, 2020)

 * BREAKING CHANGE: Event names are no longer prefixed with `appcd-`.
 * BREAKING CHANGE: Bumped minimum Node.js requirement to 10.19.0.
 * feat: Scrub potentially sensitive data in telemetry data and error messages.
 * feat: Added ability to set a `hardwareId` instead of relying on the telemetry system to identify
   a machine's unique identifier.
 * feat: Added HTTP proxy support.
 * chore: Updated dependencies.

# v4.0.0 (Jun 12, 2020)

 * BREAKING CHANGE: Requires Node.js 10.13.0 or newer.
   [(DAEMON-334)](https://jira.appcelerator.org/browse/DAEMON-334)
 * chore: Updated dependencies.

# v3.0.2 (Jan 8, 2020)

 * chore: Updated dependencies.

# v3.0.1 (Nov 6, 2019)

 * chore: Fixed homepage and repository URLs in `package.json`.
 * chore: Added links to issue trackers in readme.
 * chore: Bumped required Node.js version to 8.12.0 which is technically a breaking change, but
   `appcd-response@2.0.0` already requires Node.js 8.12.0.
 * chore: Updated dependencies.

# v3.0.0 (Aug 13, 2019)

 * BREAKING CHANGE: Updated to `appcd-machine-id@3.0.0`.
 * fix: Fixed bug where events were sent out-of-order if there was a connection error sending a
   batch of data.
 * fix: Fixed bug where the next schuduled sending of events was stopped if shutdown prior to
   scheduling.
 * fix: Fixed live config changes for environment name.
 * chore: Updated dependencies.

# v2.0.2 (Aug 13, 2019)

 * Botched release.

# v2.0.1 (Jun 13, 2019)

 * chore: Updated to `appcd-dispatcher@2.0.0`, `appcd-machine-id@2.0.1`, and `appcd-request@2.0.0`.

# v2.0.0 (Jun 10, 2019)

 * BREAKING CHANGE: Updated to `appcd-machine-id@2.0.0`.
 * refactor: Updated telemetry payload to latest specifications.
 * feat: Added `/crash` endpoint to report crash information.
 * chore: Updated dependencies.

# v1.2.1 (Mar 29, 2019)

 * chore: Updated dependencies.

# v1.2.0 (Jan 24, 2019)

 * chore: Upgraded to appcd-logger@2.0.0.

# v1.1.3 (Jan 16, 2019)

 * chore: Updated dependencies.

# v1.1.2 (Nov 27, 2018)

 * chore: Updated dependencies.

# v1.1.1 (May 24, 2018)

 * chore: Updated dependencies:

# v1.1.0 (Apr 9, 2018)

 * fix: Fixed environemnt and deploy type for telemetry events.
   [(DAEMON-241)](https://jira.appcelerator.org/browse/DAEMON-241)
 * chore: Improved readme.
 * chore: Updated dependencies:

# v1.0.1 (Dec 15, 2017)

 * chore: Updated dependencies:

# v1.0.0 (Dec 5, 2017)

 - Initial release.
