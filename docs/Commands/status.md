# ![Appc Daemon logo](../images/appc-daemon.png) Daemon Project

## `status` Command

Connects to the Appc Daemon and queries the status, then renders the status.

The status includes:

* Versions
* Process ID
* Uptime
* Memory usage
* Filesystem watcher information
* Registered plugins
* Running subprocesses

### Usage

```
appcd status [--json]
```

### Options

#### `--json`

Displays the status as JSON instead of a report format.

### Exit Codes

| Code  | Description             |
| :---: | :---------------------- |
| 0     | Success                 |
| 1     | An error occurred       |
| 2     | Showed help screen      |
| 3     | Server was not running  |

### Additional Notes

`appcd status` is a simplified way of running `appcd exec /appcd/status`.
