> [Home](../README.md) ➤ [Core Services](README.md) ➤ Plugin System Service

# Plugin System Service

Manages appcd plugins including starting, stopping, and querying plugin status.

## Services Endpoints

 * [`/appcd/plugin`](#appcdplugin)
 * [`/appcd/plugin/paths`](#appcdpluginpaths)
 * [`/appcd/plugin/registered`](#appcdpluginregistered)
 * [`/appcd/plugin/register`](#appcdpluginregister)
 * [`/appcd/plugin/unregister`](#appcdpluginunregister)
 * [`/appcd/plugin/status`](#appcdpluginstatus)
 * [`/appcd/plugin/status/:name/:version?`](#appcdpluginstatusnameversion)
 * [`/appcd/plugin/stop`](#appcdpluginstop)
 * [`/appcd/plugin/stop/:name/:version?`](#appcdpluginstopnameversion)

> :bulb: Note: The plugin info may change based on the API version which is bound to the
> `appcd-plugin` version.

## Starting a Plugin

There is no service endpoint to "start" a plugin. Simply call the plugin to start it.

For example, to start the `"@appcd/plugin-system-info@2.0.0"` plugin, you would call:
`"/system-info/2.0.0"`.

## `/appcd/plugin`

Returns the plugin paths and a list of plugins found and registered from those paths.

:sparkles: This service endpoint supports subscriptions.

### Response

```json
{
  "status": 200,
  "message": {
    "paths": [
      "/Users/username/.axway/appcd/plugins/packages",
      "/Users/username/.nvm/versions/node/v14.13.0/lib/node_modules"
    ],
    "registered": [
      {
        "appcdVersion": null,
        "os": null,
        "state": "stopped",
        "link": false,
        "activeRequests": 0,
        "totalRequests": 0,
        "dependencies": {
          "gawk": "4.7.1",
          "source-map-support": "0.5.19"
        },
        "path": "/Users/username/.axway/appcd/plugins/packages/@appcd/plugin-system-info/1.5.2",
        "packageName": "@appcd/plugin-system-info",
        "version": "1.5.2",
        "description": "The Appc Daemon plugin for detecting system info.",
        "homepage": "https://github.com/appcelerator/appc-daemon",
        "license": "Apache-2.0",
        "main": "/Users/username/.axway/appcd/plugins/packages/@appcd/plugin-system-info/1.5.2/dist/index.js",
        "name": "system-info",
        "apiVersion": "1.x || 2.x",
        "type": "external",
        "autoStart": false,
        "nodeVersion": "14.13.0",
        "error": null,
        "supported": true
      }
    ]
  },
  "fin": true,
  "statusCode": "200"
}
```

## `/appcd/plugin/paths`

Returns the plugin paths that are scanned for plugins.

### Response

```json
{
  "status": 200,
  "message": [
    "/Users/username/.axway/appcd/plugins/packages",
    "/Users/username/.nvm/versions/node/v14.13.0/lib/node_modules"
  ],
  "fin": true,
  "statusCode": "200"
}
```

## `/appcd/plugin/registered`

Returns the list of plugins that have been found and registered.

### Response

```json
{
  "status": 200,
  "message": [
    {
      "appcdVersion": null,
      "os": null,
      "state": "stopped",
      "link": false,
      "activeRequests": 0,
      "totalRequests": 0,
      "dependencies": {
        "gawk": "4.7.1",
        "source-map-support": "0.5.19"
      },
      "path": "/Users/username/.axway/appcd/plugins/packages/@appcd/plugin-system-info/1.5.2",
      "packageName": "@appcd/plugin-system-info",
      "version": "1.5.2",
      "description": "The Appc Daemon plugin for detecting system info.",
      "homepage": "https://github.com/appcelerator/appc-daemon",
      "license": "Apache-2.0",
      "main": "/Users/username/.axway/appcd/plugins/packages/@appcd/plugin-system-info/1.5.2/dist/index.js",
      "name": "system-info",
      "apiVersion": "1.x || 2.x",
      "type": "external",
      "autoStart": false,
      "nodeVersion": "14.13.0",
      "error": null,
      "supported": true
    }
  ],
  "fin": true,
  "statusCode": "200"
}
```

## `/appcd/plugin/register`

Registers a path to scan and watch for plugins. This path can be a single plugin, a directory of
plugins, a directory of nested plugins, or non-existent.

### Request Data

| Name   | Required | Description           |
| ------ | :------: | --------------------- |
| `path` |   Yes    | The path to register. |

### Response

```json
{
  "status": 201,
  "message": "Plugin path registered successfully",
  "fin": true,
  "statusCode": "201"
}
```

## `/appcd/plugin/unregister`

Unregisters a plugin path. This path can be a single plugin, a directory of plugins, a directory of
nested plugins, or non-existent.

### Request Data

| Name   | Required | Description             |
| ------ | :------: | ----------------------- |
| `path` |   Yes    | The path to unregister. |

### Response

```json
{
  "status": 201,
  "message": "Plugin path unregistered successfully",
  "fin": true,
  "statusCode": "201"
}
```

## `/appcd/plugin/status`

Returns a list containing the status for a specific plugin using an absolute path to the plugin
directory. This request will always return an array with zero or one items.

### Request Data

| Name   | Required | Description                                  |
| ------ | :------: | -------------------------------------------- |
| `path` |   Yes    | The absolute path to the plugin's directory. |

### Response

```json
{
  "status": 200,
  "message": [
    {
      "appcdVersion": null,
      "os": null,
      "state": "stopped",
      "link": false,
      "activeRequests": 0,
      "totalRequests": 0,
      "dependencies": {
        "gawk": "4.7.1",
        "source-map-support": "0.5.19"
      },
      "path": "/Users/username/.axway/appcd/plugins/packages/@appcd/plugin-system-info/1.5.2",
      "packageName": "@appcd/plugin-system-info",
      "version": "1.5.2",
      "description": "The Appc Daemon plugin for detecting system info.",
      "homepage": "https://github.com/appcelerator/appc-daemon",
      "license": "Apache-2.0",
      "main": "/Users/username/.axway/appcd/plugins/packages/@appcd/plugin-system-info/1.5.2/dist/index.js",
      "name": "system-info",
      "apiVersion": "1.x || 2.x",
      "type": "external",
      "autoStart": false,
      "nodeVersion": "14.13.0",
      "error": null,
      "supported": true
    }
  ],
  "fin": true,
  "statusCode": "200"
}
```

## `/appcd/plugin/status/:name/:version?`

Returns a list containing the status for all plugins with the given name and matching version.

### Request Parameters

| Name      | Required | Description                                                                   |
| --------- | :------: | ----------------------------------------------------------------------------- |
| `name`    |   Yes    | The plugin name such as `"@appcd/plugin-ios"` or `"myplugin"`.                |
| `version` |   No     | An exact version number or a semver range such as `"2.x"`. Defaults to `"*"`. |

### Response

```json
{
  "status": 200,
  "message": [
    {
      "appcdVersion": null,
      "os": null,
      "state": "stopped",
      "link": false,
      "activeRequests": 0,
      "totalRequests": 0,
      "dependencies": {
        "gawk": "4.7.1",
        "source-map-support": "0.5.19"
      },
      "path": "/Users/username/.axway/appcd/plugins/packages/@appcd/plugin-system-info/1.5.2",
      "packageName": "@appcd/plugin-system-info",
      "version": "1.5.2",
      "description": "The Appc Daemon plugin for detecting system info.",
      "homepage": "https://github.com/appcelerator/appc-daemon",
      "license": "Apache-2.0",
      "main": "/Users/username/.axway/appcd/plugins/packages/@appcd/plugin-system-info/1.5.2/dist/index.js",
      "name": "system-info",
      "apiVersion": "1.x || 2.x",
      "type": "external",
      "autoStart": false,
      "nodeVersion": "14.13.0",
      "error": null,
      "supported": true
    }
  ],
  "fin": true,
  "statusCode": "200"
}
```

## `/appcd/plugin/stop`

Stops a specific plugin using an absolute path to the plugin directory.

### Request Data

| Name   | Required | Description                                  |
| ------ | :------: | -------------------------------------------- |
| `path` |   Yes    | The absolute path to the plugin's directory. |

### Response

```json
{
  "status": 200,
  "message": "OK",
  "fin": true,
  "statusCode": "200"
}
```

## `/appcd/plugin/stop/:name/:version?`

Stops a plugin by name and version.

### Request Parameters

| Name      | Required | Description                                                                   |
| --------- | :------: | ----------------------------------------------------------------------------- |
| `name`    |   Yes    | The plugin name such as `"@appcd/plugin-ios"` or `"myplugin"`.                |
| `version` |   No     | An exact version number or a semver range such as `"2.x"`. Defaults to `"*"`. |

### Response

```json
{
  "status": 200,
  "message": "OK",
  "fin": true,
  "statusCode": "200"
}
```
