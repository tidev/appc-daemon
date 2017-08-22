# ![Appc Daemon logo](../../images/appc-daemon.png) Daemon Project

## `/appcd/fswatch`

Watches the specified path for changes.

### Subscribe

```js
Dispatcher
	.call('/appcd/fswatch', {
		data: {
			path: '/path/to/watch',
			recursive: false
		},
		type: 'subscribe'
	})
	.then(ctx => {
		ctx.response.on('data', data => {
			switch (data.type) {
				case 'subscribe':
					console.log(`Subscription ID = ${data.sid}`);
					console.log(`Topic = ${data.topic}`);
					break;

				case 'event':
					console.log('FS Event!', data);
					break;
			}
		});

		ctx.response.on('end', () => {
			console.log('No longer watching');
		});
	})
	.catch(err => {
		console.error(err);
	});
```

### Unsubscribe

```js
Dispatcher
	.call('/appcd/fswatch', {
		data: {
			topic: '/path/to/watch'
		},
		sid: '<sid from subscribe event>',
		type: 'unsubscribe'
	});
```
