# ![Appc Daemon logo](../images/appc-daemon.png) Daemon Project

## Node.js Clients

The `appcd-client` package is the recommended way for Node.js applications to connect to the Appc
Daemon. Internally it uses a WebSocket and manages the WebSocket subprotocol and error handling.

`appcd-client` allows you to make multiple requests over the same connection. You can also create
multiple connections, though this is not recommended. `appcd-client` connections will only ever be
dropped if an internal error occurs or the Appc Daemon is shutting down.

If the Appc Daemon is not running, it is the responsibility of the Node application that is using
the appcd-client to handle the ECONNREFUSED error code and start the Appc Daemon.

### appcd-client Example

```javascript
import Client from 'appcd-client';

new Client()
	.request({
		path: '/appcd/status'
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
