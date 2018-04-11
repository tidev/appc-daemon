# ![Appc Daemon logo](../images/appc-daemon.png) Daemon Project

## `/appcd/plugin`

Exposes the Plugin Manager.

Accessing the service returns the Plugin Manager status including the plugin paths and all plugins
found and registered in those paths.

```javascript
Dispatcher
    .call('/appcd/plugin')
    .then(result => {
        console.log(result);
    });
```

```bash
$ appcd exec /appcd/plugin
```

### `/appcd/plugin/register`

Registers a plugin path. This path can be a single plugin, a directory of plugins, a directory of
nested plugins, or non-existent.

```javascript
Dispatcher
    .call('/appcd/plugin/register', {
        path: '/path/to/directory'
    })
    .then(result => {
		// 200 Plugin Registered
        console.log(result);
    });
```

```bash
$ appcd exec /appcd/plugin/register '{"path":"/path/to/directory"}'
```

### `/appcd/plugin/unregister`

Unregisters a plugin path. This path can be a single plugin, a directory of plugins, a directory of
nested plugins, or non-existent.

```javascript
Dispatcher
    .call('/appcd/plugin/unregister', {
        path: '/path/to/directory'
    })
    .then(result => {
		// 200 Plugin Unregistered
        console.log(result);
    });
```

```bash
$ appcd exec /appcd/plugin/unregister '{"path":"/path/to/directory"}'
```

### `/appcd/plugin/stop`

Stops all versions of all plugins associated with the specified plugin path.

```javascript
Dispatcher
    .call('/appcd/plugin/stop', {
        path: '/path/to/directory'
    })
    .then(result => {
		// 200 OK
        console.log(result);
    });
```

```bash
$ appcd exec /appcd/plugin/stop '{"path":"/path/to/directory"}'
```

### `/appcd/plugin/stop/<PLUGIN_NAME>`

Stops all versions of the specified plugin name.

```javascript
Dispatcher
    .call('/appcd/plugin/stop/foo')
    .then(result => {
		// 200 OK
        console.log(result);
    });
```

```bash
$ appcd exec /appcd/plugin/stop/foo
```

### `/appcd/plugin/stop/<PLUGIN_NAME>/<VERSION>`

Stops a specific version or version range for the specified plugin name.

```javascript
Dispatcher
    .call('/appcd/plugin/stop/foo/1.0.0')
    .then(result => {
		// 200 OK
        console.log(result);
    });
```

```bash
$ appcd exec /appcd/plugin/stop/foo/1.0.0
```

```javascript
Dispatcher
    .call('/appcd/plugin/stop/foo/2.x')
    .then(result => {
		// 200 OK
        console.log(result);
    });
```

```bash
$ appcd exec /appcd/plugin/stop/foo/2.x
```

### `/appcd/plugin/status`

Returns the status of all registered plugins.

```javascript
Dispatcher
    .call('/appcd/plugin/status')
    .then(result => {
		// 200 OK
        console.log(result);
    });
```

```bash
$ appcd exec /appcd/plugin/status
```

To get a single plugin's status by path:

```bash
$ appcd exec /appcd/plugin/status '{"path":"/path/to/directory"}'
```

### `/appcd/plugin/status/<PLUGIN_NAME>`

Gets the status for all plugins matching the specified name.

```javascript
Dispatcher
    .call('/appcd/plugin/status/appcd-plugin-titanium-sdk')
    .then(result => {
		// 200 OK
        console.log(result);
    });
```

```bash
$ appcd exec /appcd/plugin/status/appcd-plugin-titanium-sdk
```

### `/appcd/status/<PLUGIN_NAME>/<VERSION>`

Gets the status for all plugins matching the specified name and version range.

```javascript
Dispatcher
    .call('/appcd/plugin/status/appcd-plugin-titanium-sdk/1.x')
    .then(result => {
		// 200 OK
        console.log(result);
    });
```

```bash
$ appcd exec /appcd/plugin/status/appcd-plugin-titanium-sdk/1.x
```
