# ![Appc Daemon logo](../images/appc-daemon.png) Daemon Project

## `/appcd/status/:filter`

Queries that status of the daemon.

```javascript
const result = await Dispatcher.call('/appcd/status');
console.log(result);
```

```bash
appcd exec /appcd/status
```

Additional path segments filter the result.

```javascript
const mem = await Dispatcher.call('/appcd/status/system/memory');
console.log(`Free mem = ${mem.free}`);
console.log(`Total mem = ${mem.total}`);
```
