> [Home](../README.md) ➤ [Core Services](README.md) ➤ Subprocess Service

# Subprocess Service

Spawns subprocesses that can be sent IPC messages or terminated.

## Services Endpoints

 * [`/appcd/subprocess`](#appcdsubprocess)
 * [`/appcd/subprocess/kill/:pid`](#appcdsubprocesskill)
 * [`/appcd/subprocess/send/:pid`](#appcdsubprocesssend)
 * [`/appcd/subprocess/spawn`](#appcdsubprocessspawn)
 * [`/appcd/subprocess/spawn/node/:version?`](#appcdsubprocessspawnnodeversion)

## `/appcd/subprocess`

Returns a list of all active subprocesses.

:sparkles: This service endpoint supports subscriptions.

### Example

```
$ appcd exec /appcd/subprocess
```

#### Response

```json
{
  "message": [
    {
      "pid": 65043,
      "command": "/usr/local/bin/node",
      "args": [
        "/path/to/appcd-plugin/bin/appcd-plugin-host",
        "/path/to/plugins/amplify"
      ],
      "options": {
        "windowsHide": true,
        "cwd": "/",
        "env": {
          "FORCE_COLOR": "1"
        },
        "stdio": [
          "pipe",
          "pipe",
          "pipe",
          "ipc"
        ]
      },
      "startTime": "2020-11-18T07:08:58.353Z"
    }
  ],
  "fin": true,
  "statusCode": "200"
}
```

## `/appcd/subprocess/kill/:pid`

Sends a signal to a process.

### Request Data

| Name     | Type   | Required | Description           |
| -------- | ------ | :------: | --------------------- |
| `signal` | String |   No     | The signal to send to the child process. Defaults to `"SIGTERM"`. |

### Example

```
$ appcd exec /appcd/subprocess/kill/12345
```

#### Response

```json
{
  "status": 200,
  "message": "OK",
  "fin": true,
  "statusCode": "200"
}
```

## `/appcd/subprocess/send/:pid`

Sends a JSON object to a process over IPC.

### Request Data

The request data is an optional object to send in its entirety to the child process.

### Example

```
$ appcd exec /appcd/subprocess/send/12345 '{ "foo": "bar" }'
```

#### Response

```json
{
  "status": 200,
  "message": {
    "success": true
  },
  "fin": true,
  "statusCode": "200"
}
```

## `/appcd/subprocess/spawn`

Spawns a subprocess.

### Request Data

| Name                  | Type            | Required | Description           |
| --------------------- | --------------- | :------: | --------------------- |
| `command`             | String          |   Yes    | The command to run.   |
| `args`                | Array[String]   |   No     | An array of arguments to pass into the command. |
| `options`             | Object          |   No     | Spawn options.        |
| `options.cwd`         | String          |   No     | The current working directory. |
| `options.env`         | Object          |   No     | A map of environment variables to expose to the subprocess. |
| `options.stdio`       | String \| Array |   No     | The same stdio options as Node's `child_process.spawn()`. Value is converted to an array and the IPC channel is appended. |
| `options.windowsHide` | Boolean         |   No     | When `true` hides the intermediate Windows command prompt from being displayed. |

### Example

```
$ appcd exec /appcd/subprocess/spawn '{ "command":"echo", "args": [ "Hello!" ] }'
```

#### Response

```json
{
  "type": "spawn",
  "pid": 6843,
  "status": 200,
  "statusCode": "200"
}
{
  "type": "stdout",
  "output": "Hello!\n"
}
{
  "type": "exit",
  "code": 0
}
```

### Example

```javascript
await Dispatcher.call('/appcd/subprocess/spawn', {
    data: {
        command: 'sleep',
        args: [ '10' ]
    }
});
```

## `/appcd/subprocess/spawn/node/<version>`

Spawn Node.js with the specified script file.

| Name                  | Type            | Required | Description           |
| --------------------- | --------------- | :------: | --------------------- |
| `command`             | String          |   Yes    | The command to run.   |
| `args`                | Array[String]   |   No     | An array of arguments to pass into the command. |
| `options`             | Object          |   No     | Spawn options.        |
| `options.cwd`         | String          |   No     | The current working directory. |
| `options.env`         | Object          |   No     | A map of environment variables to expose to the subprocess. |
| `options.stdio`       | String \| Array |   No     | The same stdio options as Node's `child_process.spawn()`. Value is converted to an array and the IPC channel is appended. |
| `options.windowsHide` | Boolean         |   No     | When `true` hides the intermediate Windows command prompt from being displayed. |

### Example

```
$ appcd exec /appcd/subprocess/spawn/node '{ "args": [ "-e", "console.log(\"Hello\")" ] }'
```

#### Response

```json
{
  "type": "spawn",
  "pid": 13469,
  "status": 200,
  "statusCode": "200"
}
{
  "type": "stdout",
  "output": "Hello\n"
}
{
  "type": "exit",
  "code": 0
}
```

### Example

Run a script:

```javascript
await Dispatcher.call('/appcd/subprocess/spawn/node', {
    data: {
        args: [ '/path/to/myscript.js' ]
    }
})
```

Run a script using a specific Node.js version:

```javascript
await Dispatcher.call('/appcd/subprocess/spawn/node/7.8.0', {
    data: {
        args: [ '/path/to/myscript.js' ]
    }
});
```
