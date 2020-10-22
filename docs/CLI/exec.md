> [Home](../README.md) ➤ [CLI](README.md) ➤ exec

# `exec`

Connects to the Appc Daemon and dispatches a service request. The request may include a data
payload and subscribe to a service.

## Usage

	appcd exec <path> [<json>] [--subscribe]

### Arguments

 * #### `<path>`
   The request path. Paths can optionally start with a forward slash (`/`).

 * #### `<json>`
   An optional string containing JSON that is parsed and sent along with the request.

### Options

 * #### `--subscribe`
   Subscribes to the requested service. When the service publishes an event, the data is received
   and rendered to the terminal.

## Examples

Get the daemon status:

	appcd exec /appcd/status

Watch the daemon memory usage:

	appcd exec /appcd/status/system/memory --subscribe

## Exit Codes

| Code  | Description             |
| :---: | :---------------------- |
|   0   | Success                 |
|   1   | An error occurred       |
|   2   | Showed help screen      |
|   3   | Server was not running  |
