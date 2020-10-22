> [Home](../README.md) ➤ [CLI](README.md) ➤ status

# `status` Command

Connects to the Appc Daemon and queries the status, then renders the status.

The status includes:

* Versions: appcd, plugin API, Node.js
* Process ID
* Uptime
* Memory usage
* Filesystem watchers
* Plugins
* Running subprocesses
* Daemon core and plugin process health

## Usage

	appcd status [--json]

### Options

 * #### `--json`
   Displays the status as JSON instead of a report format.

## Exit Codes

| Code  | Description             |
| :---: | :---------------------- |
|   0   | Success                 |
|   1   | An error occurred       |
|   2   | Showed help screen      |
|   3   | Server was not running  |
