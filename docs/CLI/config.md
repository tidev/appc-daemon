> [Home](../README.md) ➤ [CLI](README.md) ➤ config

# `config`

Queries and manages the Appc Daemon configuration.

If the Appc Daemon is running, the `config` command will connect to it and use the runtime
configuration. When altering the configuration, the server will check to see whether the setting can
be changed while the Appc Daemon is running. If the setting can be changed, then it will alter the
running configuration setting and save the setting to the user config file. If the setting is
read-only, then an error is returned.

You can force settings to be changed by specifying the `--force` flag and if the setting is
read-only, it will notify the user to restart the Appc Daemon.

If the Appc Daemon is _not_ running, then the `config` command will use the config files. When
altering a config setting, it will save the setting to the user config file.

The user config file is located at `~/.axway/appcd/config.json`.

For the list of config settings, visit the [Config Settings](../Config-Settings.md) document.

## Actions

 * `get` - Display a specific config setting
 * `ls`, `list` - Display all config settings
 * `pop` - Remove the last value in a list
 * `push` - Add a value to the end of a list
 * `rm`, `delete` - Remove a config setting
 * `set` - Change a config setting
 * `shift` - Remove the first value in a list
 * `unshift` - Add a value to the beginning of a list

### General Action Arguments

 * #### `<key>` (applies to all actions)
   A dot-notation config setting to get such as `telemetry.enabled`. If there is no `key` specified, then the entire configuration is returned.

 * #### `<value>` (applies to all mutable actions)
   The value to set. If the config setting has metadata that describes the data type, then the
   value will be validated and coerced into the correct data type.

### General Action Options

 * #### `--force` (applies to mutable actions)
   Has no effect when the Appc Daemon is not running. If the Appc Daemon is running and the config
   setting being set is read-only, then it will force the value to be saved, but will require a
   restart for the setting to take effect.

 * #### `--json` (applies to all actions)
   Displays the status as JSON instead of text format.

## `get`

Returns a config value or section.

	appcd config get [<key>] [--json]

## `ls`, `list`

Displays the current configuration in either text or JSON format.

	appcd config ls [--json]
	# or
	appcd config list [--json]

## `set`

Sets a config setting. If the Appc Daemon is running and the config setting is read-only, then the
`set` subcommand will fail unless `--force` has been specified.

If the config setting already exists, then it is overwritten by the new value. Use `push`, `pop`,
`shift`, or `unshift` to change an array config setting.

Changing certain settings while daemon will running will also update the runtime value.

	appcd config set <key> <value> [--force] [--json]

## `rm`, `delete`

Removes the specified user-defined config value. When a config value is removed, the daemon will
revert to the config setting's default value.

If the Appc Daemon is running and the config setting is read-only, then
the `set` subcommand will fail unless `--force` has been specified. All empty namespaces will be
pruned.

	appcd config rm <key> [--force] [--json]
	# or
	appcd config delete <key> [--force] [--json]

## `push`

Add a value to the end of a list. If the key does not exist, it will initialize it to an empty
array. If the config setting already exists, but is not an array, it will convert the value to an
array containing the existing value.

	appcd config push <key> <value> [--force] [--json]

## `pop`

Remove the last value in a list.

	appcd config pop <key> [--force] [--json]

## `shift`

Remove the first value in a list.

	appcd config shift <key> [--force] [--json]

## `unshift`

Add a value ot the beginning of a list. If the key does not exist, it will initialize it to an
empty array. If the config setting already exists, but is not an array, it will convert the value
to an array containing the existing value.

	appcd config unshift <key> <value> [--force] [--json]

## Exit Codes

| Code  | Description                                          |
| :---: | :--------------------------------------------------- |
|   0   | Success                                              |
|   1   | An error occurred                                    |
|   2   | Showed help screen                                   |
|   6   | Config setting is not found                          |
|   7   | Configuration setting is read-only                   |
|   8   | Server must be restarted for changes to take effect  |
