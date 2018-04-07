# appcd-client

The Node.js client for connecting to the Appc Daemon. Internally appcd-client uses a WebSocket for
communicating with the server.

Visit https://github.com/appcelerator/appc-daemon for more information.

## Installation

	npm i appcd-client

## Usage

```js
import Client from 'appcd-client';

const client = new Client();

client
	.request('/appcd/status')
	.on('response', status => {
		console.log(status);
		client.disconnect();
	})
	.on('error', err => {
		console.error('ERROR!');
		console.error(err);
	});
```

To subscribe to a service:

```js
client
	.request({
		path: '/appcd/status/system/loadavg',
		type: 'subscribe'
	})
	.on('response', status => {
		console.log(status);
		client.disconnect();
	})
	.on('error', err => {
		console.error('ERROR!');
		console.error(err);
	});
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/appc-daemon/packages/appcd-client/LICENSE
