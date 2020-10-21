> [Home](../README.md) ➤ [CLI](README.md) ➤ start

# `start`

Starts the Appc Daemon. If it's already running, then the command fails and exits.

## Usage

	appcd start [--config <json>] [--config-file <file>] [--debug]

### Options

 * #### `--config <json>`
   A string containing JSON that is parsed and merged into the Appc Daemon configuration prior to
   starting the Appc Daemon. These JSON config settings overrides the default configuration and all
   loaded config files.

 * #### `--config-file <file>`
   A path to a config file to load. Defaults to `~/.axway/appcd/config.js`.

 * #### `--debug`
   Starts the Appc Daemon in debug mode where the spawned Core subprocess is not detached and
   stdout and stderr are inherited allowing the Core to render log output directly to the terminal.

   Simply press <kbd>CTRL-C</kbd> to quit the Appc Daemon.

## Exit Codes

| Code  | Description                |
| :---: | :------------------------- |
|   0   | Success                    |
|   1   | An error occurred          |
|   2   | Showed help screen         |
|   4   | Server is already running  |
|   5   | Server was run as root     |
