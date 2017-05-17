# ![Appc Daemon logo](../../images/appc-daemon.png) Daemon Project

## `/appcd/subprocess`

Exposes the Subprocess Manager.

### `/appcd/subprocess/spawn`

```javascript
Dispatcher
    .call('/appcd/subprocess/spawn', {
        command: 'sleep',
        args: ['10']
    })
    .then(result => {
        console.log('Done!');
    });
```

### `/appcd/subprocess/spawn/node/<version>`

For convenience, the Subprocess Manager has `/spawn/node` and `/spawn/node/<version>` endpoints. For
example, if a plugin is being spawned and the plugin requires Node.js 7.8.0, then it will download
and install that version use it to run the specified JavaScript file. Note that unlike `/spawn`,
`/spawn/node` does not require the `command` parameter.

```javascript
Dispatcher
    .call('/appcd/subprocess/spawn/node', {
        args: ['/path/to/myscript.js']
    })
    .then(result => {
        console.log('Done!');
    });
```

```javascript
Dispatcher
    .call('/appcd/subprocess/spawn/node/7.8.0', {
        args: ['/path/to/myscript.js']
    })
    .then(result => {
        console.log('Done!');
    });
```
