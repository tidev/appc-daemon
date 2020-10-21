> [Home](../README.md) ➤ [Integration](README.md) ➤ HTTP

# Node.js Clients

The [`appcd-client`](https://npmjs.org/package/appcd-client) package is the recommended way for Node.js applications to connect to the Appc
Daemon. Internally it uses a WebSocket and manages the WebSocket subprotocol and error handling.

`appcd-client` allows you to make multiple requests over the same connection. You can also create
multiple connections, though this is not recommended. `appcd-client` connections will only ever be
dropped if an internal error occurs or the Appc Daemon is shutting down.

If the Appc Daemon is not running, it is the responsibility of the Node application that is using
the appcd-client to handle the ECONNREFUSED error code and start the Appc Daemon.

## Examples

### Basic Service Request Example

Connect to the Appc Daemon and get the status. If the Appc Daemon is not running, the `"error"`
event is emitted with the `"ECONNREFUSED"` code.

```js
import Client from 'appcd-client';

new Client()
	.request('/appcd/status')
	.on('response', status => {
		console.log(status);
		client.disconnect();
	})
	.on('close', () => process.exit(0))
	.on('error', err => {
		console.error(err.message);
		process.exit(1);
	});
```

### Auto-start Daemon Example

Start the daemon if not running, then get the status.

```js
(async () => {
	const client = new Client();

	try {
        // connect to the daemon and start it if its not running.
        await new Promise((resolve, reject) => {
            client
                .connect({ startDaemon: true })
                .on('connected', resolve)
                .on('error', reject);
        });

		// make the request
        await new Promise((resolve, reject) => {
            client
                .request('/appcd/status')
                .on('response', status => {
                    console.log(status);
                    client.disconnect();
                    resolve();
				})
				.on('close', resolve)
                .on('error', reject);
        });
    } catch (err) {
        console.error('ERROR!');
        console.error(err);
    }
})();
```

### Service Subscription Example

Several services offer real-time updates such as the status and config services.

Here's an example that prints the latest system CPU load usage:

```js
new Client()
    .request({
        path: '/appcd/status/system/loadavg',
        type: 'subscribe'
    })
    .on('response', status => {
        console.log(status);
	})
	.on('close', () => process.exit(0))
    .on('error', err => {
        console.error('ERROR!');
		console.error(err);
		process.exit(1);
    });
```
