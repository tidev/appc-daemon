> [Home](../../README.md) ➤ [Development](../README.md) ➤ [Components](README.md) ➤ Dispatcher

> :warning: Under construction.

# Dispatcher

The Dispatcher is the central message bus that connects all services together. It is the "mediator"
in the [mediator pattern](https://en.wikipedia.org/wiki/Mediator_pattern). All requests, both
internal and external, are routed through the Dispatcher. The Dispatcher is implemented in the
`appcd-dispatcher` package.

Handlers are registered with the Dispatcher using a path (or route) and a handler function. Requests
(or calls) are routed using a specific path and a request payload. When a matching handler is found,
the handler can either fulfill the request or pass it along. If no handler is found, a "404 not
found" error response is returned.

```javascript
Dispatcher.register('/myservice', ctx => {
    ctx.response = 'got it!';
});

Dispatcher
    .call('/myservice')
    .then(result => {
        console.log(result.response);
    });
```

The Dispatcher supports asynchronous handlers by using Promises.

```javascript
function doSomething(ctx) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            ctx.response = 'thanks for waiting';
            resolve();
        }, 1000);
    });
}

Dispatcher.register('/myservice', async (ctx) => {
    await doSomething(ctx);
});

Dispatcher
    .call('/myservice')
    .then(result => {
        console.log(result.response);
    });
```

### Scopes

Dispatchers can contain scoped dispatchers. This is handy for letting services export a dispatcher
instance and then let the daemon wire it into the root dispatcher instance.

```javascript
const foo = new Dispatcher;

foo.register('/foo', ctx => {
    ctx.response = 'foo!';
});

Dispatcher.register('/myservice', foo);

Dispatcher
    .call('/myservice/foo')
    .then(result => {
        console.log(result.response);
    });
```

### Dispatcher Context

The Dispatcher passes a `DispatcherContext` to each matched route handler. This context contains
the request payload, response, and response status. The payload may be null, an empty object, or an
object with request data. The response is initialized to a
[PassThrough](https://nodejs.org/dist/latest/docs/api/stream.html#stream_class_stream_passthrough)
stream. A handler may write to the stream or override it with a value which will be automatically
serialized. The stream response is used for transmitting files or emitting (or publishing) data.

### Service Dispatcher

The `ServiceDispatcher` is a special Dispatcher that can be registered to a path and facilitates a
publish/subscribe based response. It will track active subscriptions using a topic name so that
multiple subscribers reuse the same data source. For example, if you have two different clients
interested in memory usage, it will listen for memory usage changes one time, then emit any updates
to both clients. When there are no more active subscriptions, then the handler is automatically
unsubscribed.

```javascript
Dispatcher.register('/myservice', new ServiceDispatcher({
	onCall(ctx) {
		ctx.response = 'howdy!';
	},

	initSubscription({ ctx, publish, sid, topic }) {
		// this is called the first time a subscription to the specified topic is started
		// `publish()` is the same function that is passed into the `destroySubscription()` handler
	}

	onSubscribe({ ctx, publish, sid, topic }) {
		// this is called every time a new subscription is added
		// `publish()` is sends a message to just the new subscriber unlike `initSubscription()`
		// which sends the message to all subscribers

		if (!this.timer) {
			this.timer = setInterval(() => {
				publish({ ts: Date.now() });
			}, 1000);
		}
	},

	onUnsubscribe({ ctx, sid, topic }) {
		// this is called every time a subscription has been cancelled
		// note that there is no `publish()` param
		clearTimeout(this.timer);
	},

	destroySubscription({ ctx, publish, sid, topic }) {
		// this is called after all subscriptions for the specific topic have been cancelled
	}
}));

// trigger `onCall()`
Dispatcher
    .call('/myservice')
    .then(result => {
        console.log(result.response);
    });

// trigger `onSubscribe()`
Dispatcher
    .call('/myservice', { type: 'subscribe' })
    .then(ctx => {
		ctx.response.on('data', data => {
			console.log(data);

			switch (data.type) {
				case 'subscribe':
					console.log('subscription id = ', data.sid);
					break;
				case 'unsubscribe':
					console.log('subscription has been cancelled');
					break;
			}
		});
    });
```

### Responses

Dispatcher responses may be a single value, stream of values, a `Response` object, or an
`AppcdError` object. In the event the response is a `Response` or `AppcdError` object, the response
object contains both a message and a status. The message and status can be derived using a single
response code, a combination of a code and a message, or just a message. The responses codes can be
referenced by the constant name or the numeric value. All built-in response messages can be
internationalized.

```javascript
Dispatcher.register('/myservice', ctx => {
    ctx.response = new Response(codes.OK); // sets message to 'OK' and status to 200
});
```
