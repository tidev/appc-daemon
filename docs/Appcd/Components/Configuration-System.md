# ![Appc Daemon logo](../../images/appc-daemon.png) Daemon Project

## Configuration System

The Appc Daemon config system is implemented in the `appcd-config` package. It supports both `.js`
`.json` config files.

`appcd-config` goes beyond loading config files. It supports a default config file, user-defined
config file, user-defined config object, and environment specific config files. It also allows you
to define config setting metadata.

The config can be queried or altered by using the [appcd config](../Commands/config.md) command or
the [/appcd/config](../Services/config.md) service.

Config setting names __cannot__ contain periods (`.`).

### Config File Types

`.js` config files are CommonJS modules that export a JavaScript object. When a .js config file is
being loaded, the config file's AST is parsed using Babylon to ensure the file is syntactically
valid, then the config setting's metadata is extracted from the JSDoc style comments. Assuming the
file is ok, it will be evaluated in a virtual sandbox and the exported config is extracted and
merged into the config object.

`.json` config files are simple and safe, but lack support for comments and metadata. A `.json`
config file may have an accompanying .json.metadata file that contains each config setting's
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
