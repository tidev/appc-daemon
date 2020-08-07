# ![Appc Daemon logo](../images/appc-daemon.png) Daemon Project

## Configuration System

The Appc Daemon contains a default configuration file located inside the `appcd-core` package.
User-defined config settings are stored in `~/.axway/appcd/config.json`.

## Usage

The daemon configuration can be accessed via the CLI, WebSocket (external), appcd client
(external), or programmatically (internal).

### Actions

 * `ls`, `list` - Display all config settings.
 * `get` - Display a specific setting.
 * `set` - Sets a config setting and saves it in the user-defined config file.
 * `rm`, `delete`, `remove`, `unset` - Remove a config setting.
 * `push` - Add a value to the end of a list.
 * `pop` - Remove the last value in a list.
 * `shift` - Removes the first value in a list.
 * `unshift` - Add a value to the beginning of a list.

### `appcd config` CLI command

```sh
# show the help screen
$ appcd config
$ appcd config -h
$ appcd config --help

$ appcd config [options] <action> [<key>] [<value>]
```

Refer to the [config command](Commands/config.md) page for more information.

### Config Service via `appcd` CLI

```sh
$ appcd exec /appcd/config

$ appcd exec /appcd/config/{action}
```

### `appcd-client` for Node.js

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

### WebSocket Client

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

## Implementation

The Appc Daemon config system is implemented in the `appcd-config` package. It supports both `.js`
`.json` config files.

Config settings are stored in ordered namespaces, then merged together to form the official config
settings. There are three built-in namespaces:

 * `Base` - Holds initial state such as the default settings.
 * `User` - Contains the user-defined settings.
 * `Runtime` - Command line defined settings that override all other settings.

Additional namespaces can be added and reside between the `Base` and `User` namespaces.

```
<base>
  ...
    <user>
      <runtime>
```

When a setting is changed via [`appcd config`](../Commands/config.md) or the
[`/appcd/config`](../Services/config.md) service, the new value is written to both the `Runtime` and
`User` namespaces, then the `User` namespace is written to disk.

Config setting names __cannot__ contain periods (`.`).

### Config File Types

`.js` config files are CommonJS modules that export a JavaScript object. When a .js config file is
being loaded, the config file's AST is parsed using Babylon to ensure the file is syntactically
valid, then the config setting's metadata is extracted from the JSDoc style comments. Assuming the
file is ok, it will be evaluated in a virtual sandbox and the exported config is extracted and
merged into the config object.

`.json` config files are simple and safe, but lack support for comments and metadata. A `.json`
config file may have an accompanying `.json.metadata` file that contains each config setting's
metadata.

### Metadata

Config settings may have metadata that describes the setting, its data type, and if it's writable at
runtime. The data type is used to coerce a setting set via the command line or a request to the
intended value. Some settings such as the port that the Appc Daemon listens are read-only and will
only take effect after the server is restarted.

#### `.js` Config With Metadata Example

`example.config.js`

```javascript
module.exports = {
    server: {
        /**
         * The name of the server.
         * @type {String}
         */
        name: null,

        /**
         * When true, detaches from stdio.
         * @type {Boolean}
         */
        daemonize: true,

        /**
         * The port to listen on.
         * @type {Number}
         * @readonly
         */
        port: 1337
    }
};
```

#### `.json` Config With Metadata Example

`example.config.json`

```json
{
    "server": {
        "name": null,
        "daemonize": true,
        "port": 1337
    }
}
```

`example.config.json.metadata`

```json
{
    "server.name": {
        "desc": "The name of the server.",
        "type": "String"
    },
    "server.daemonize": {
        "desc": "When true, detaches from stdio.",
        "type": "Boolean"
    },
    "server.port": {
        "desc": "The port to listen on.",
        "type": "Number",
        "nullable": true,
        "readonly": true
    }
}
```
