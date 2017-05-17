# ![Appc Daemon logo](../../images/appc-daemon.png) Daemon Project

## `help` Command

Displays the `appcd` commands and options.

### Usage

```
appcd help [--json]

appcd help <command> [--json]

appcd <command> -h

appcd <command> --help
```

### `appcd help`
### `appcd help <command>`

Displays help or help for a specific command.

#### Options

##### `--json`

Displays the help as JSON instead of text.

#### Exit Codes

| Code  | Description     |
| :---: | :-------------- |
| 0     | Success         |

### `appcd <command> -h`
### `appcd <command> --help`

Displays command specific help.

#### Exit Codes

| Code  | Description         |
| :---: | :------------------ |
| 2     | Showed help screen  |
