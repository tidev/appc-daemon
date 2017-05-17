# ![Appc Daemon logo](../../images/appc-daemon.png) Daemon Project

## `restart` Command

Stops and restarts the Appc Daemon. If the Appc Daemon is not running, then it will continue to
start it.

### Usage

```
appcd restart [--config <json>] [--config-file <file>] [--debug]
```

### Options

#### `--config <json>`

A string containing JSON that is parsed and merged into the Appc Daemon configuration prior to
starting the Appc Daemon. These JSON config settings overrides the default configuration and all
loaded config files.

#### `--config-file <file>`

A path to a config file to load. Defaults to `~/.appcelerator/appcd/config.js`.

#### `--debug`

Starts the Appc Daemon in debug mode where the spawned Core subprocess is not detached and stdout
and stderr are inherited allowing the Core to render log output directly to the terminal.

Simply press `CTRL-C` to quit the Appc Daemon

### Exit Codes

| Code  | Description                |
| :---: | :------------------------- |
| 0     | Success                    |
| 1     | An error occurred          |
| 2     | Showed help screen         |
| 4     | Server is already running  |
| 5     | Server was run as root     |
