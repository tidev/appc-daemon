# ![Appc Daemon logo](../../images/appc-daemon.png) Daemon Project

## `start` Command

Starts the Appc Daemon. If it's already  if it's not already running. The Appc Daemon uses a PID file to ensure only one instance is running at a time. The Appc Daemon also performs a stale PID check just in case a previous Appc Daemon instance crashed.
appcd start [--config <json>] [--config-file <file>] [--debug]
Options
--config <json>
A string containing JSON that will be parsed and merged into the daemon configuration prior to starting the daemon.
--config-file <file>
A path to a config file to load. Defaults to ~/.appcelerator/appcd/config.js.
--debug
Starts the Appc Daemon in debug mode. This launches the daemon in the current terminal instead of a background subprocess. Log output is displayed to stdout.
Arguments
None.
