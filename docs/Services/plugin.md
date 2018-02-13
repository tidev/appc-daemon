# ![Appc Daemon logo](../images/appc-daemon.png) Daemon Project

## `/appcd/plugin`

Exposes the Plugin Manager.

Accessing the service returns the Plugin Manager status.

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

### `/appcd/stop`

Stops all versions of all plugins associated with the specified plugin path.

```javascript
Dispatcher
    .call('/appcd/stop', {
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

### `/appcd/stop/<PLUGIN_NAME>`

Stops all versions of the specified plugin name.

```javascript
Dispatcher
    .call('/appcd/stop/foo')
    .then(result => {
		// 200 OK
        console.log(result);
    });
```

```bash
$ appcd exec /appcd/plugin/stop/foo
```

### `/appcd/stop/<PLUGIN_NAME>/<VERSION>`

Stops a specific version or version range for the specified plugin name.

```javascript
Dispatcher
    .call('/appcd/stop/foo/1.0.0')
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
    .call('/appcd/stop/foo/2.x')
    .then(result => {
		// 200 OK
        console.log(result);
    });
```

```bash
$ appcd exec /appcd/plugin/stop/foo/2.x
```
