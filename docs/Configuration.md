# ![Appc Daemon logo](images/appc-daemon.png) Daemon Project

## Configuration

The Appc Daemon contains a default configuration file located inside the `appcd-core` package.
User-defined config settings are stored in `~/.appcelerator/appcd/config.json`.

The daemon configuration can be accessed via the CLI, WebSocket (external), appcd client
(external), or programmatically (internal).

For information about the implementation details of the config system, please refer to the
[configuration system](Components/Configuration-System.md) page.

## Actions

 * `ls`, `list` - Display all config settings.
 * `get` - Display a specific setting.
 * `set` - Sets a config setting and saves it in the user-defined config file.
 * `rm`, `delete` - Remove a config setting.
 * `push` - Add a value to the end of a list.
 * `pop` - Remove the last value in a list.

## `appcd config` CLI command

```sh
# show the help screen
$ appcd config
$ appcd config -h
$ appcd config --help

$ appcd config [options] <action> [<key>] [<value>]
```

Refer to the [config command](Commands/config.md) page for more information.

## Config Service via `appcd` CLI

```sh
$ appcd exec /appcd/config

$ appcd exec /appcd/config/{action}
```

## `appcd-client` for Node.js

```js
import Client from 'appcd-client';

new Client()
	.request({
		path: '/appcd/config'
	})
	.on('response', (message, response) => {
		console.log(message);
		process.exit(0);
	})
	.once('close', () => process.exit(0))
	.once('error', err => {
		console.error(err.message);
		process.exit(1);
	});
```

## WebSocket Client

HTML:

```html
<script src="https://rawgit.com/kawanet/msgpack-lite/master/dist/msgpack.min.js"></script>
```

JavaScript:

```js
const ws = new WebSocket('ws://127.0.0.1:1732');
ws.binaryType = 'arraybuffer';

ws.onopen = () => ws.send(JSON.stringify({
    version: '1.0',
    path: '/appcd/config',
    id: Date.now()
}));

ws.onmessage = evt => {
	const status = msgpack.decode(new Uint8Array(evt.data)).message;
    console.info(status);
};
```
