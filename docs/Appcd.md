# ![Appc Daemon logo](images/appc-daemon.png) Daemon Project

## appcd

_appcd_ is the name of the public package that contains the Appc Daemon command line interface (CLI)
and bootstrap. It is responsible for starting, stopping, and querying the Appc Daemon. Users will
install _appcd_ via NPM.


The _appcd_ CLI is responsible for:

 * Managing the Appc Daemon configuration
 * Ensure the required version of Node.js is installed (and downloads it if needed)
 * Spawning the [Appc Daemon Core](Appcd_Core.md) as a detached background process
 * Querying the status of the Appc Deamon
 * Executing requests directly into the Appc Daemon
