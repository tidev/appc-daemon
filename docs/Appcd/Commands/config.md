# ![Appc Daemon logo](../../images/appc-daemon.png) Daemon Project

## `config` Command

Queries and manages the Appc Daemon configuration.

If the Appc Daemon is running, the `config` command will connect to it and use the running
configuration. When altering the configuration, the server will check to see whether the setting can
be changed while the Appc Daemon is running. If the setting can be changed, then it will alter the
running configuration setting and save the setting to the user config file. If the setting is
read-only, then an error is returned. You can force settings to be changed by specifying the
`--force` flag and if the setting is read-only, it will notify the user to restart the Appc Daemon.

If the Appc Daemon is _not_ running, then the `config` command will use the config files. When
altering a config setting, it will save the setting to the user config file.

The user config file is located at `~/.appcelerator/appcd/config.json`.

For the list of config settings, visit the [Configuration](../Configuration.md) document.

For information about how the Appc Daemon configuration system works, visit the
[Configuration System](../Components/Configuration-System.md) document.

### `list`

```
appcd config

appcd config list
```

Displays the current configuration in either text or JSON format. The `list` subcommand is the
default when running `appcd config`.

#### Options

##### `--json`

Displays the status as JSON instead of text format.

### `get`

```
appcd config get [<key>] [--json]
```

Returns a config value or section.

#### Arguments

##### `<key>`

A dot-notation config setting to get such as `telemetry.enabled`. If there is no `key` specified,
then the entire configuration is returned.

#### Options

##### `--json`

Displays the status as JSON instead of text format.

### `set`

```
appcd config set <key> <value> [--force] [--json]
```

Sets a config setting. If the Appc Daemon is running and the config setting is read-only, then the
`set` subcommand will fail unless `--force` has been specified. If the config setting already
exists, then it is overwritten by the new value.

#### Arguments

##### `<key>`

A dot-notation config setting to get such as `telemetry.enabled`. If there is no `key` specified,
then the entire configuration is returned.

##### `<value>`

The value to set. If the config setting has metadata that describes the data type, then the value
will be validated and coerced into the correct data type. If the config setting's data type is an
array, `set` will clobber the existing array. Use `push`, `pop`, `shift`, or `unshift` to manipulate
an array config setting.

#### Options

##### `--force`

Has no effect when the Appc Daemon is not running. If the Appc Daemon is running and the config
setting being set is read-only, then it will force the value to be saved, but will require a restart
for the setting to take effect.

##### `--json`

Displays the status as JSON instead of text format.

### `delete`

```
appcd config delete <key> [--force] [--json]
```

Removes the specified key. If the Appc Daemon is running and the config setting is read-only, then
the `set` subcommand will fail unless `--force` has been specified. All empty namespaces will be
pruned.

#### Arguments

##### `<key>`

A dot-notation config setting to get such as `telemetry.enabled`. If there is no `key` specified,
then the entire configuration is returned.

#### Options

##### `--force`

Has no effect when the Appc Daemon is not running. If the Appc Daemon is running and the config
setting being set is read-only, then it will force the value to be saved, but will require a restart
for the setting to take effect.

##### `--json`

Displays the status as JSON instead of text format.

### `push`, `pop`, `shift`, `unshift`

```
appcd config push <key> <value> [--force] [--json]

appcd config pop <key> <value> [--force] [--json]

appcd config shift <key> <value> [--force] [--json]

appcd config unshift <key> <value> [--force] [--json]
```

Manipulates array config settings. If the key does not exist, it will initialize it to an empty
array. If the config setting already exists, but is not an array, it will convert the value to an
array containing the existing value.

#### Arguments

##### `<key>`

A dot-notation config setting to get such as `telemetry.enabled`. If there is no `key` specified,
then the entire configuration is returned.

##### `<value>`

The value to set. If the config setting has metadata that describes the data type, then the value
will be validated and coerced into the correct data type.

#### Options

##### `--force`

Has no effect when the Appc Daemon is not running. If the Appc Daemon is running and the config
setting being set is read-only, then it will force the value to be saved, but will require a restart
for the setting to take effect.

##### `--json`

Displays the status as JSON instead of text format.

### Exit Codes

| Code  | Description                                          |
| :---: | :--------------------------------------------------- |
| 0     | Success                                              |
| 1     | An error occurred                                    |
| 2     | Showed help screen                                   |
| 6     | Configuration setting is read-only                   |
| 7     | Server must be restarted for changes to take effect  |
