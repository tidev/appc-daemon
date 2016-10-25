# appcd-client

The Node.js client for connecting to the Appc Daemon.

## Usage

```javascript
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

## API Documentation

To generate API docs into static HTML files, run:

	gulp docs
