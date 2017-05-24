# ![Appc Daemon logo](../../images/appc-daemon.png) Daemon Project

## `help` Command

Displays the `appc` commands and options.

### Usage

```
appc help [--json]

appc help <command> [--json]

appc <command> -h

appc <command> --help
```

### `appc help`
### `appc help <command>`

Displays help or help for a specific command.

#### Options

##### `--json`

Displays the help as JSON instead of text.

#### Exit Codes

| Code  | Description     |
| :---: | :-------------- |
| 0     | Success         |

### `appc <command> -h`
### `appc <command> --help`

Displays command specific help.

#### Exit Codes

| Code  | Description         |
| :---: | :------------------ |
| 2     | Showed help screen  |
