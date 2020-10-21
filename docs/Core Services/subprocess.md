> [Home](../README.md) ➤ [Core Services](README.md) ➤ Subprocess Service

> :warning: Under construction.

# Subprocess Service

Spawns subprocesses that can be sent IPC messages or killed.

## Services Endpoints

 * [`/appcd/subprocess`](#appcdsubprocess)
 * [`/appcd/subprocess/kill/:pid`](#appcdsubprocesskill)
 * [`/appcd/subprocess/send/:pid`](#appcdsubprocesssend)
 * [`/appcd/subprocess/spawn`](#appcdsubprocessspawn)
 * [`/appcd/subprocess/spawn/node/:version?`](#appcdsubprocessspawnnodeversion)

## `/appcd/subprocess`

Returns a list of all active subprocesses.

### `/appcd/subprocess/spawn`

Spawns a subprocess.

```javascript
Dispatcher
    .call('/appcd/subprocess/spawn', {
        data: {
            command: 'sleep',
            args: ['10']
        }
    })
    .then(result => {
        console.log('Done!');
    });
```

### `/appcd/subprocess/spawn/node/<version>`

Spawn Node.js with the specified script file.

```javascript
Dispatcher
    .call('/appcd/subprocess/spawn/node', {
        data: {
            args: ['/path/to/myscript.js']
        }
    })
    .then(result => {
        console.log('Done!');
    });
```

```javascript
Dispatcher
    .call('/appcd/subprocess/spawn/node/7.8.0', {
        data: {
            args: ['/path/to/myscript.js']
        }
    })
    .then(result => {
        console.log('Done!');
    });
```
