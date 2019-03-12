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

## `ServiceDispatcher`

A `ServiceDispatcher` is an abstract base class for implementing services that support calls and
subscriptions. You must not directly instantiate a `ServiceDispatcher`, but rather define your own
class that extends it.

If your service just needs to serve a simple object or array dataset, such as a gawked object, then
you should use the [`DataServiceDispatcher`](#DataServiceDispatcher). `ServiceDispatcher` is
intended for intances where you need strict control.

Examples of a `ServiceDispatcher` being used are the [`ConfigService`][2] and
[`FSWatchManager`][3].

```js
import { ServiceDispatcher } from 'appcd-dispatcher';

export default class MyService extends ServiceDispatcher {
	onCall(ctx) {
		return 'Hello from my service';
	}
}
```

The following are all of the methods that your `ServiceDispatcher` derived class can implement:

### `onCall(ctx)`

Handles a request with a single response. Note that the response can be a stream, but not efficient
if there are multiple incoming requests.

| Param | Type                               | Description                                                          |
| ----- | ---------------------------------- | -------------------------------------------------------------------- |
| `ctx` | [`DispatcherContext`][5] ([docs][4]) | A dispatcher context containing the original request and a response. |

Returns anything. When result is a `DispatcherContext`, it is returned to the `Dispatcher`. When
result is _not_ `undefined`, then it is stored in the response of the `DispatcherContext`
(`ctx.response`) and returned to the dispatcher. `onCall()` may also return a `Promise` which
resolves a response as previously described.

This method is optional.

### `getTopic(ctx)`

Returns a topic based on the request context.

| Param | Type                               | Description                                                          |
| ----- | ---------------------------------- | -------------------------------------------------------------------- |
| `ctx` | [`DispatcherContext`][5] ([docs][4]) | A dispatcher context containing the original request and a response. |

Returns a `String`.

This method is optional. By default, the `ServiceDispatcher` will use the `ctx.realPath`.

### `initSubscription({ ctx, publish(), sid, topic })`

Called before the first subscription for the given topic is requested. If all subscriptions have
been unsubscribed, then the next subscription event would invoke this callback.

| Param       | Type                                 | Description |
| ----------- | ------------------------------------ | ----------- |
| `ctx`       | [`DispatcherContext`][5] ([docs][4]) | A dispatcher context containing the original request and a response. |
| `publish()` | `Function`                           | A function that should be called when your service wants to publish an event to all topic subscribers. |
| `sid`       | `String`                             | The subscription id. Useful for unsubscribing. |
| `topic`     | `String`                             | The subscription topic derived from `getTopic()` or `ctx.realPath`. |

This method returns `undefined` and is optional unless you are using `onSubscribe()`.

### `onSubscribe({ ctx, publish(), sid, topic })`

Called when a new subscription is requested. Requires the `initSubscription()` method to be defined.

| Param       | Type                                 | Description |
| ----------- | ------------------------------------ | ----------- |
| `ctx`       | [`DispatcherContext`][5] ([docs][4]) | A dispatcher context containing the original request and a response. |
| `publish()` | `Function`                           | A function that should be called when your service wants to publish an event to all topic subscribers. |
| `sid`       | `String`                             | The subscription id. Useful for unsubscribing. |
| `topic`     | `String`                             | The subscription topic derived from `getTopic()` or `ctx.realPath`. |

This method returns `undefined` and is optional.

### `onUnsubscribe({ ctx, publish(), sid, topic })`

Called when a subscription has been unsubscribed. Requires the `destroySubscription()` method to be defined.

| Param       | Type                                 | Description |
| ----------- | ------------------------------------ | ----------- |
| `ctx`       | [`DispatcherContext`][5] ([docs][4]) | A dispatcher context containing the original request and a response. |
| `sid`       | `String`                             | The subscription id. Useful for unsubscribing. |
| `topic`     | `String`                             | The subscription topic derived from `getTopic()` or `ctx.realPath`. |

This method returns `undefined` and is optional.

### `destroySubscription()`

Called after the last subscription for the given topic has been unsubscribed.

| Param       | Type                                 | Description |
| ----------- | ------------------------------------ | ----------- |
| `ctx`       | [`DispatcherContext`][5] ([docs][4]) | A dispatcher context containing the original request and a response. |
| `publish()` | `Function`                           | A function that should be called when your service wants to publish an event to all topic subscribers. |
| `sid`       | `String`                             | The subscription id. Useful for unsubscribing. |
| `topic`     | `String`                             | The subscription topic derived from `getTopic()` or `ctx.realPath`. |

Note that `publish()` is not intended to be invoked, but rather used to remove any event listeners.

This method returns `undefined` and is optional unless you are using `onUnsubscribe()`.

## `DataServiceDispatcher`

A `DataServiceDispatcher` is a `ServiceDispatcher` implementation for wiring up a object or array
dataset to a data-only service. It gives you automatic data responses with filtering and
subscriptions.

`DataServiceDispatcher` has an property called `data`. It must be a [gawked object][8]. You can
either pass an object into the constructor or override `this.data` with your own gawked object.

If you pass in an object, the `DataServiceDispatcher` will gawk it for you, then directly update
properties of `data`.

```js
import { DataServiceDispatcher } from 'appcd-dispatcher';

export default class MyDataService extends DataServiceDispatcher {
	constructor() {
		super({
			ts: Date.now()
		});

		setInterval(() => {
			this.data.ts = Date.now();
		}, 1000);
	}
}
```

Examples of a `DataServiceDispatcher` being used are the [`StatusMonitor`][6] and
[`PluginManagerStatus`][7].

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/appc-daemon/blob/master/packages/appcd-dispatcher/LICENSE
[2]: https://github.com/appcelerator/appc-daemon/blob/master/packages/appcd-config-service/src/config-service.js
[3]: https://github.com/appcelerator/appc-daemon/blob/master/packages/appcd-fswatch-manager/src/fswatch-manager.js
[4]: https://github.com/appcelerator/appc-daemon/blob/master/docs/Components/Dispatcher.md#dispatcher-context
[5]: https://github.com/appcelerator/appc-daemon/blob/master/packages/appcd-dispatcher/src/dispatcher-context.js
[6]: https://github.com/appcelerator/appc-daemon/blob/master/packages/appcd-core/src/status-monitor.js
[7]: https://github.com/appcelerator/appc-daemon/blob/master/packages/appcd-plugin/src/plugin-manager.js
[8]: https://www.npmjs.com/package/gawk