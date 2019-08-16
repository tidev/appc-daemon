# appcd-client

The Node.js client for connecting to the Appc Daemon. Internally appcd-client uses a WebSocket for
communicating with the server.

Visit https://github.com/appcelerator/appc-daemon for more information.

Report issues to [GitHub issues][2]. Official issue tracker in [JIRA][3].

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

## Starting the Appc Daemon

`request()` will automatically call `connect()`, however it will error if the daemon is not
running. You can call `connect()` prior to making your request and specify the `startDaemon` flag:

```js
const client = new Client();

(async () => {
	try {
		// connect to the daemon and start it if its not running.
		await new Promise((resolve, reject) => {
			client
				.connect({ startDaemon: true })
				.on('connected', resolve)
				.on('error', reject);
		});

		await new Promise((resolve, reject) => {
			client
				.request('/appcd/status')
				.on('response', status => {
					console.log(status);
					client.disconnect();
					resolve();
				})
				.on('error', reject);
		});
	} catch (err) {
		console.error('ERROR!');
		console.error(err);
	}
})();
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/appc-daemon/blob/master/packages/appcd-client/LICENSE
[2]: https://github.com/appcelerator/appc-daemon/issues
[3]: https://jira.appcelerator.org/projects/DAEMON/issues
