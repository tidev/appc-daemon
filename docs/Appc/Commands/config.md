# ![Appc Daemon logo](../../images/appc-daemon.png) Daemon Project

## `config` Command

Queries and manages the Appc CLI configuration.

### `list`

```
appc config

appc config list
```

Displays the current configuration in either text or JSON format. The `list` subcommand is the
default when running `appc config`.

#### Options

##### `--json`

Displays the status as JSON instead of text format.

### `get`

```
appc config get [<key>] [--json]
```

Returns a config value or section.

#### Arguments

##### `<key>`

A dot-notation config setting to get such as `some.key`. If there is no `key` specified, then the
entire configuration is returned.

#### Options

##### `--json`

Displays the status as JSON instead of text format.

### `set`

```
appc config set <key> <value> [--json]
```

Sets a config setting.

#### Arguments

##### `<key>`

A dot-notation config setting to get such as `some.key`. If there is no `key` specified, then the
command errors.

##### `<value>`

The value to set. If the config setting has metadata that describes the data type, then the value
will be validated and coerced into the correct data type. If the config setting's data type is an
array, `set` will clobber the existing array. Use `push`, `pop`, `shift`, or `unshift` to manipulate
an array config setting.

#### Options

##### `--json`

Displays the status as JSON instead of text format.

### `delete`

```
appc config delete <key> [--json]
```

Removes the specified key. All empty namespaces will be pruned.

#### Arguments

##### `<key>`

A dot-notation config setting to get such as `some.key`. If there is no `key` specified, then the
command errors.

#### Options

##### `--json`

Displays the status as JSON instead of text format.

### `push`, `pop`, `shift`, `unshift`

```
appc config push <key> <value> [--json]

appc config pop <key> <value> [--json]

appc config shift <key> <value> [--json]

appc config unshift <key> <value> [--json]
```

Manipulates array config settings. If the key does not exist, it will initialize it to an empty
array. If the config setting already exists, but is not an array, it will convert the value to an
array containing the existing value.

#### Arguments

##### `<key>`

A dot-notation config setting to get such as `some.key`. If there is no `key` specified, then the
command errors.

##### `<value>`

The value to set. If the config setting has metadata that describes the data type, then the value
will be validated and coerced into the correct data type.

#### Options

##### `--json`

Displays the status as JSON instead of text format.

### Exit Codes

| Code  | Description                                          |
| :---: | :--------------------------------------------------- |
| 0     | Success                                              |
| 1     | An error occurred                                    |
| 2     | Showed help screen                                   |
