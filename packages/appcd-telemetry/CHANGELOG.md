# v2.0.2

 * fix: Fixed bug where events were sent out-of-order if there was a connection error sending a
   batch of data.
 * fix: Fixed bug where the next schuduled sending of events was stopped if shutdown prior to
   scheduling.
 * fix: Fixed live config changes for environment name.
 * chore: Updated dependencies.

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
