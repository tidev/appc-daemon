# appcd-dispatcher

Provides an HTTP-like API for registering and invoking service endpoints.

Visit https://github.com/appcelerator/appc-daemon for more information.

## Installation

	npm i appcd-dispatcher

## Usage

### Dispatcher Instance

```js
import Dispatcher from 'appcd-dispatcher';

const dispatcher = new Dispatcher();

dispatcher.register('/foo/:id?', ctx => {
	if (ctx.request.params.id) {
		return {
			message: `hello ${ctx.request.params.id}!`
		};
	}

	return {
		message: 'hello guest!'
	};
});

try {
	// 200
	let ctx = await dispatcher.call('/foo');
	console.log('Response:', ctx.response);

	// 200 with parameter
	ctx = await dispatcher.call('/foo/123');
	console.log('Response:', ctx.response);

	// 404
	await dispatcher.call('/bar');
} catch (err) {
	console.error(err);
}
```

### Global Dispatcher Instance

`Dispatcher` has a static `register()`, `unregister()`, and `call()` methods.

```js
Dispatcher.register('/foo/:id?', ctx => {
	const { id } = ctx.request.params;
	ctx.response = {
		message: `hello ${id || 'guest'}!`
	};
});
```

### Streaming Handler

```js
Dispatcher.register('/foo', ({ response }) => {
	setInterval(() => {
		response.write(new Date().toString());
	}, 1000);
});
```

### Responses

Response statuses are based on HTTP status codes. Successful calls return a `200` status, bad
requests return a `400` status, route not found returns a `404` status, and errors return a `500`
status.

Route handlers can throw any `Error` and the dispatcher will return it as a `500`.

[appcd-response](https://npmjs.org/package/appcd-response) provides `Response` and `AppcdError`
classes to assist with return messages with specific text and statuses.

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/appc-daemon/blob/master/packages/appcd-dispatcher/LICENSE
