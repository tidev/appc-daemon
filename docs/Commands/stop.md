# ![Appc Daemon logo](../images/appc-daemon.png) Daemon Project

## `stop` Command

Stops the Appc Daemon.

### Usage

```
appcd stop [--force]
```

### Options

#### `--force`

Forces the daemon to shutdown. This is the equivalent to doing a `kill -9`. It will not allow the
running Appc Daemon to gracefully shutdown, so `--force` should be used sparingly.

### Exit Codes

| Code  | Description             |
| :---: | :---------------------- |
| 0     | Success                 |
| 1     | An error occurred       |
| 2     | Showed help screen      |
| 3     | Server was not running  |
