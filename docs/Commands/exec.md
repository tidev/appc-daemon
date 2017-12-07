# ![Appc Daemon logo](../images/appc-daemon.png) Daemon Project

## `exec` Command

Connects to the Appc Daemon and dispatches a service request. The request may include a data
payload and subscribe to a service.

### Usage

```
appcd exec <path> [<json>] [--subscribe]
```

### Arguments

#### `<path>`

The request path. Paths can optionally start with a forward slash (`/`).

#### `<json>`

An optional string containing JSON that is parsed and sent along with the request.

### Options

#### `--subscribe`

Subscribes to the requested service. When the service publishes an event, the data is received and
rendered to the terminal.

### Exit Codes

| Code  | Description             |
| :---: | :---------------------- |
| 0     | Success                 |
| 1     | An error occurred       |
| 2     | Showed help screen      |
| 3     | Server was not running  |
