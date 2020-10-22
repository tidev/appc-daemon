> [Home](../README.md) ➤ CLI

# Command Line Interface

The Appc Daemon's CLI is called `appcd`. To get a list of available commands, run:

	appcd

## Commands

| Name                  | Description                                                |
| --------------------- | ---------------------------------------------------------- |
| [`config`](config.md)   | Manage configuration options                               |
| [`dump`](dump.md)       | Dumps the config, status, health, and debug logs to a file |
| [`exec`](exec.md)       | Connects to the Appc Daemon and executes the request       |
| [`logcat`](logcat.md)   | Streams Appc Daemon debug log output                       |
| [`pm`](pm.md)           | List, install, update, search, and uninstall appcd plugins |
| [`restart`](restart.md) | Stops the Appc Daemon if running, then starts it           |
| [`start`](start.md)     | Starts the Appc Daemon if it's not already running         |
| [`status`](status.md)   | Displays the Appc Daemon status                            |
| [`stop`](stop.md)       | Stops the Appc Daemon if running                           |

## Global Options

| Name                   | Descrption                                          |
| ---------------------- | --------------------------------------------------- |
| `--no-banner`          | Suppress the banner                                 |
| `--no-color`           | Disable colors                                      |
| `--config=[json]`      | Serialized JSON string to mix into the appcd config |
| `--config-file=[file]` | Path to a appcd JS config file                      |
| `-h`, `--help`         | Displays the help screen                            |
| `-v`, `--version`      | Outputs the version                                 |
