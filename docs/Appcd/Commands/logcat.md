# ![Appc Daemon logo](../../images/appc-daemon.png) Daemon Project

## `logcat` Command

Connects to the daemon and streams the log output from the daemon. Upon connection, it will receive
the latest 250 lines of log output.

All log messages are written to stdout.

Press <kbd>CTRL-C</kbd> to quit.

### Usage

```
appcd logcat [<filter>] [--no-colors]
```

### Examples

To only show telemetry and dispatcher messages:

```
appcd logcat "appcd:telemetry" "appcd:dispatcher"

appcd logcat "appcd:telemetry,appcd:dispatcher"
```

To show every log message except status messages:

```
appcd logcat "-appcd:core:status"
```

To show detect engine log messages:

```
appcd logcat "*appcd:detect*"
```

### Arguments

#### `<filter...>`

One or more logger namespace filter by. The filters may be a comma-separated list of filters or
specified individually. Prepend the filter with a dash `-` to ignore all messages with the matching
namespace. You may also use `*` wildcards. Specifying no filter is equivalent to `*`.

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
