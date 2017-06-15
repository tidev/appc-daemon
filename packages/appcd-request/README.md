# appcd-request

Appc Daemon service for making HTTP requests.

## Usage

Refer to the request (https://github.com/request/request) documentation for information about the
supported options.

```javascript
Dispatcher.register('/appcd/request', new RequestService);

Dispatcher
	.call('/appcd/request', {
		url: 'http://127.0.0.1:1338',
		method: 'GET' // default
	})
	.then(ctx => {
		console.log(ctx.status);

		let body = '';
		ctx.response
			.on('data', data => {
				body += data;
			})
			.on('end', () => {
				console.log(body);
			});
	})
	.catch(err => {
		console.error(err);
	});
```
