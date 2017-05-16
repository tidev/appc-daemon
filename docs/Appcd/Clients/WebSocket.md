# ![Appc Daemon logo](../../images/appc-daemon.png) Daemon Project

## WebSocket Clients

The Appc Daemon's web server accepts WebSocket connections. By default, the web server listens on
port `1732`.

WebSocket clients can make service requests or subscribe to service events, but cannot
make application endpoint or static file requests.

Requests can be made by any WebSocket client such as a web browser or a library.

Multiple requests can be made simulataneously over the same WebSocket connection. WebSocket
connections will only ever be dropped if an internal error occurs or the Appc Daemon is shutting
down.

If the Appc Daemon is not running, it is the responsibility of the calling application to start the
Appc Daemon.

### Subprotocol

WebSockets operate on a simple message passing API where there is no request or response. The Appc
Daemon uses a simple subprotocol that introduces requests and responses.

The subprotocol is a serialized JSON object that contains a `version`, `type`, `id`, `path`, and
optionally a `data` payload.

#### Request Message Format

```json
{
    "version": "1.0",
	"type": "call",
	"id": "<unique request id>",
    "path": "/path/to/service",
    "data": {
        "foo": "bar"
    }
}
```

| Property  | Data Type        | Required | Description                                      |
| :-------- | :--------------- | :------: | :----------------------------------------------- |
| `version` | String           | Yes      | The version of the subprotocol. Must be `"1.0"`. |
| `type`    | String           | No       | The request type. Must be either `"call"` (default), `"subscribe"`, or `"unsubscribe"`. |
| `id`      | String or Number | Yes      | A unique request id. Used by the client to match the response id. A UUID or `Date.now()` is recommended. |
| `path`    | String           | Yes      | The service path. Paths can, but don't have to, begin with a forward slash `/`. |
| `data`    | Object           | No       | An optional data payload. Data cannot contain functions or circular references. |

#### Response Message Format

```json
{
    "id": "<unique request id>",
    "status": 200,
    "message": {
        "foo": "bar"
    }
}
```

| Property  | Data Type        | Description                                      |
| :-------- | :--------------- | :----------------------------------------------- |
| `status`  | Number           | The status code for the request which is based on HTTP status codes. |
| `id`      | String or Number | The unique request id. Used by the client to match the response id. |
| `message` | Object           | When the status is 2xx, then `message` contains the result. When the status is 4xx or 5xx, then `error` contains an error message. |
| `type`    | String           | When the request `type` is `"subscribe"` or `"unsubscribe"`, then the response `type` will be `"subscribe"`, `"publish"`, or `"unsubscribe"`. If status is 4xx or 5xx, then `type` is `"error"`. |
| `topic`   | String           | When the request `type` is `"subscribe"`, all responses will include the topic name that is used to unsubscribe. |

#### Status Codes

Response status codes are mapped to `appcd-response` codes, which are based on a subset of HTTP
status codes. Internally, response status codes can be a decimal number such as `200.1` where the
decimal part is the "subcode". When the Dispatcher response system detects an HTTP client, the
subcode is stripped from the response status code resulting in a valid HTTP status code.

For more information about Dispatcher status codes, please refer to the
[Dispatcher](../Components/Dispatcher.md) documenation.

#### Binary Encoded Response Messages

If the request was successful, the response `message` will be encoded using MessagePack and will
need to be decoded. [msgpack-lite](https://www.npmjs.com/package/msgpack-lite) is a fast pure
JavaScript MessagePack encoder and decoder which the Appc Daemon uses.

Unsuccessful requests will not have an encoded response `message` as to make the error more
accessible in the event of error.

### Service Subscriptions

Only WebSocket clients can request a subscription to a service. The first response is a
`"subscribe"` response followed by zero or more `"publish"` event messages.

A subscription is active until an `"unsubscribe"` request is received for the subscription topic or
the WebSocket client disconnects.

### Web Browser Call Example

```javascript
const ws = new WebSocket('ws://127.0.0.1:1732');

ws.onopen = () => ws.send(JSON.stringify({
    version: '1.0',
    path: '/appcd/status',
    id: Date.now()
}));

ws.onmessage = evt => {
    console.info('Got status!');
    console.info(evt.data);
};
```

### Node.js Call Example

This example uses the [ws](https://www.npmjs.com/package/ws) and
[msgpack-lite](https://www.npmjs.com/package/msgpack-lite) packages.

```javascript
const msgpack = require('msgpack-lite');
const util = require('util');
const WebSocket = require('ws');

const ws = new WebSocket('ws://127.0.0.1:1732', {
		headers: {
			'User-Agent': __filename
		}
	})
	.on('message', (msg, flags) => {
		console.log(util.inspect(flags.binary ? msgpack.decode(msg) : JSON.parse(msg), false, null, true));
		process.exit(0);
	})
	.on('close', () => console.log('CLOSED'))
	.on('open', () => ws.send(JSON.stringify({ version: '1.0', path: '/appcd/status', id: Date.now() })));
```

### Node.js Subscribe Example

```javascript
const msgpack = require('msgpack-lite');
const util = require('util');
const WebSocket = require('ws');

const ws = new WebSocket('ws://127.0.0.1:1732', {
		headers: {
			'User-Agent': __filename
		}
	})
	.on('message', (msg, flags) => {
		console.log(util.inspect(flags.binary ? msgpack.decode(msg) : JSON.parse(msg), false, null, true));
	})
	.on('close', () => console.log('CLOSED'))
	.on('open', () => ws.send(JSON.stringify({ version: '1.0', path: '/appcd/status', id: Date.now(), type: 'subscribe' })));
```
