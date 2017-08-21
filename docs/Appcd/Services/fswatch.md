# ![Appc Daemon logo](../../images/appc-daemon.png) Daemon Project

## `/appcd/fswatch`

Watches the specified path for changes.

```js
Dispatcher
	.call('/appcd/fswatch', {
		data: {
			path: dir,
			recursive
		},
		type: 'subscribe'
	})
	.then(ctx => {
		ctx.response.on('data', data => {
			//
		});

		ctx.response.on('end', () => {
			console.log('No longer watching');
		});
	})
	.catch(err => {
		console.error(err);
	});
```
