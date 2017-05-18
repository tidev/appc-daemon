# ![Appc Daemon logo](../../images/appc-daemon.png) Daemon Project

## `logcat` Command

Connects to the daemon and streams the log output from the daemon. Upon connection, it will receive
the latest 250 lines of log output.

All log messages are written to stdout.

Press <kbd>CTRL-C</kbd> to quit.

### Usage

```
appcd logcat [--no-colors]
```

### Options

#### `--no-colors`

By default, the log messages are displayed in color. By specifying this flag, it will disable
colors.

### Exit Codes

| Code  | Description             |
| :---: | :---------------------- |
| 0     | Success                 |
| 1     | An error occurred       |
| 2     | Showed help screen      |
| 3     | Server was not running  |
