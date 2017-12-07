# ![Appc Daemon logo](../images/appc-daemon.png) Daemon Project

## `dump` Command

Connects to the Appc Daemon and retrieves the config, status, health, and debug log. If the daemon
is not running, it will only return the configuration loaded from disk.

### Usage

```
appcd dump [<file>]
```

### Arguments

#### `<file>`

An optional filename to write the dump to instead of `stdout`.

### Exit Codes

| Code  | Description             |
| :---: | :---------------------- |
| 0     | Success                 |
| 1     | An error occurred       |
| 2     | Showed help screen      |
