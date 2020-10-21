> [Home](../README.md) ➤ [Core Services](README.md) ➤ Config Service

# Config Service

Manages the daemon configuration at runtime including getting, setting, and deleting values,
watching values for changes, and loading and saving config files.

## Services Endpoints

 * [`/appcd/config`](#appcdconfig)
 * [`/appcd/config/:filter?`](#appcdconfigfilter)

## `/appcd/config`

Handles a multitude of config related actions. The "action" is set in the request data payload and
can be one of the following:

 * [`"get"`](#actionget)
 * [`"load"`](#actionload)
 * [`"unload"`](#actionunload)
 * [`"set"`](#actionset)
 * [`"delete"`](#actiondelete)
 * [`"push"`](#actionpush)
 * [`"pop"`](#actionpop)
 * [`"shift"`](#actionshift)
 * [`"unshift"`](#actionunshift)

Any write operation will trigger a change event and any listeners will be notified. For example,
setting `"network.proxy"` will notify several appcd components and plugins. In this case, the
telemetry system would receive the notification and use the new proxy setting for future HTTP
requests.

## Action: `get`

### Request Data

| Name       | Required | Description                |
| ---------- | :------: | -------------------------- |
| `action`   |    Yes   | Set to `"get"`.            |
| `key`      |    No    | A dot-notation config key. |

The `key` doesn't have to be a leaf node with a simple data type. You can get an object of values.
For example, you can specify `"network"` to get an object containing all of the network settings.

### Example

Return the entire configuration:

```json
{
  "action": "get"
}
```

```
$ appcd exec /appcd/config '{"action":"get"}'
```

To get a specific value, specify the key:

```json
{
  "action": "get",
  "key": "server.port"
}
```

### Response

Returns the value or an error if key does not exist.

```json
{
  "status": 200,
  "message": 1732,
  "fin": true,
  "statusCode": "200"
}
```

`"message"` contains the value.

## Action: `load`

Loads a config file into a namespaced layer.

> :bulb: Note: This feature is designed for things like plugins where the config data is namespaced
> in the config data. You cannot load a config file into the top-level of the config object.

### Request Data

| Name        | Required | Description                                        |
| ----------- | :------: | -------------------------------------------------- |
| `action`    |   Yes    | Set to `"load"`.                                   |
| `id`        |   Yes*   | The id to use for the config layer.                |
| `namespace` |   Yes*   | The top-level key name the config is loaded under. |

\* A load request must have either an `id` or a `namespace` or both.

The `id` is a unique identifier for the underlying config layer. For example, the system info's
plugin config file is loaded with an `id` that is the plugin's package name and version such as
`"@appcd/plugin-system-info@2.0.0"`.

The `namespace` is the "bucket" that the config file is loaded under. This is needed to avoid
pollution of the entire config object. For example, the system info plugin would have a namespace
of `"systeminfo"` so that you can get `"/appcd/config/systeminfo/foo"`.

### Response

```json
{
  "status": 200,
  "message": "OK",
  "fin": true,
  "statusCode": "200"
}
```

## Action: `unload`

Unloads a config file's namespaced layer.

### Request Data

| Name        | Required | Description                                        |
| ----------- | :------: | -------------------------------------------------- |
| `action`    |   Yes    | Set to `"unload"`.                                 |
| `id`        |   Yes*   | The id to use for the config layer.                |
| `namespace` |   Yes*   | The top-level key name the config is loaded under. |

\* An unload request must have either an `id` or a `namespace` or both.

### Response

```json
{
  "status": 200,
  "message": "OK",
  "fin": true,
  "statusCode": "200"
}
```

Returns an error if the `id` (or `namespace`) is not found.

## Action: `set`

Sets a config value and saves the layer to disk. If the value already exists, it is overwritten.

### Request Data

| Name     | Required | Description                |
| -------- | :------: | -------------------------- |
| `action` |   Yes    | Set to `"set"`.            |
| `key`    |   Yes    | A dot-notation config key. |
| `value`  |   No     | The value to set.          |

### Example

```
$ appcd exec /appcd/config '{"action":"set", "key":"foo", "value":"bar"}'
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

## Action: `delete`

Deletes a config key. If the key does not exist, it will _not_ throw an error.

### Request Data

| Name     | Required | Description                |
| -------- | :------: | -------------------------- |
| `action` |   Yes    | Set to `"delete"`.         |
| `key`    |   Yes    | A dot-notation config key. |

### Example

```
$ appcd exec /appcd/config '{"action":"delete", "key":"foo"}'
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

## Action: `push`

Adds a value to the end of an array value. If the key does not exist, the destination will be
initialized to an empty array. If the key does exist, but the destination is not an array, the
destination will be converted to an array containing the existing value and then the new value is
added.

### Request Data

| Name     | Required | Description                |
| -------- | :------: | -------------------------- |
| `action` |   Yes    | Set to `"push"`.           |
| `key`    |   Yes    | A dot-notation config key. |
| `value`  |   No     | The value to add.          |

### Example

```
$ appcd exec /appcd/config '{"action":"push", "key":"foo", "value":"bar"}'
```

## Response

```json
{
  "status": 200,
  "message": "OK",
  "fin": true,
  "statusCode": "200"
}
```

## Action: `pop`

Removes the last element of an array value. If the key does not exist, it will _not_ throw an
error. If the key does exist, but the destination is not an array, the destination will be
converted to an array containing the existing value and then the value is removed from the array
resulting in an empty array value.

### Request Data

| Name     | Required | Description                |
| -------- | :------: | -------------------------- |
| `action` |   Yes    | Set to `"pop"`.            |
| `key`    |   Yes    | A dot-notation config key. |

### Example

```
$ appcd exec /appcd/config '{"action":"pop", "key":"foo"}'
```

#### Response

```json
{
  "status": 200,
  "message": "bar",
  "fin": true,
  "statusCode": "200"
}
```

`"message"` contains the value that was popped. If the value is an empty array, then there is
nothing to pop and `undefined` is returned. However `undefined` values are stripped from the
response when it is serialized.

## Action: `shift`

Removes the first element of an array value. If the key does not exist, it will _not_ throw an
error. If the key does exist, but the destination is not an array, the destination will be
converted to an array containing the existing value and then the value is removed from the array
resulting in an empty array value.

### Request Data

| Name     | Required | Description                |
| -------- | :------: | -------------------------- |
| `action` |   Yes    | Set to `"shift"`.          |
| `key`    |   Yes    | A dot-notation config key. |

### Example

```
$ appcd exec /appcd/config '{"action":"shift", "key":"foo"}'
```

#### Response

```json
{
  "status": 200,
  "message": "bar",
  "fin": true,
  "statusCode": "200"
}
```

`"message"` contains the value that was shifted.

## Action: `unshift`

Adds a value to the beginning of an array value. If the key does not exist, the destination will be
initialized to an empty array. If the key does exist, but the destination is not an array, the
destination will be converted to an array containing the existing value and then the new value is
added.

### Request Data

| Name     | Required | Description                |
| -------- | :------: | -------------------------- |
| `action` |   Yes    | Set to `"push"`.           |
| `key`    |   Yes    | A dot-notation config key. |
| `value`  |   No     | The value to add.          |

### Example

```
$ appcd exec /appcd/config '{"action":"unshift", "key":"foo", "value":"bar"}'
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

## `/appcd/config/:filter?`

Gets the config object, then applies the specified filter. If no filter is specified, the entire
config is returned.

:sparkles: This service endpoint supports subscriptions.

### Example

```
$ appcd exec /appcd/config/server/port
```

#### Response

```json
{
  "status": 200,
  "message": 1732,
  "fin": true,
  "statusCode": "200"
}
```

## Coding Tip

For plugin development or internal appcd development, you can use the following pattern to try and
get a config value, but fallback to a default if the value does not exist.

```js
const timeout = await Dispatcher.call('/appcd/config/some/timeout')
  .then(ctx => ctx.response)
  .catch(() => 5000); // default to 5 seconds or whatever
```
