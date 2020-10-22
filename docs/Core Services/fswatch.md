> [Home](../README.md) ➤ [Core Services](README.md) ➤ Filesystem Watcher Service

# Filesystem Watcher Service

Watches a directory or file for changes.

## `/appcd/fswatch`

Starts watching a directory or file for changes. If the path is a directory, an event will be
emitted if the directory is renamed, deleted, added, or the contents of the directory has changed.

> :bulb: Note: This service only supports subscription requests. Attempting to call the service
> without subscribing will result in a 404 not found response.

### Subscribe Request Payload

| Name        | Required | Description                                                |
| ----------- | :------: | ---------------------------------------------------------- |
| `data.path` |   Yes    | The path to watch. Internally, this is called the "topic". |
| `type`      |   Yes    | Must be `"subscribe"`. |

### Subscribe Response

```json
{
  "message": "Subscribed",
  "sid": "b5ab29b4-cab3-4097-9615-a171df669c62",
  "topic": "/Users/username/Desktop",
  "type": "subscribe",
  "status": 201,
  "statusCode": "201"
}
```

When an event occurs, it will emit:

```json
{
  "message": {
    "action": "add",
    "filename": "foo",
    "file": "/Users/username/Desktop/foo"
  },
  "sid": "b5ab29b4-cab3-4097-9615-a171df669c62",
  "topic": "/Users/username/Desktop",
  "type": "event",
  "status": 200,
  "statusCode": "200"
}
```

### Subscribe Request Payload

| Name   | Required | Description              |
| ------ | :------: | ------------------------ |
| `sid`  |   Yes    | The subscription id.     |
| `type` |   Yes    | Must be `"unsubscribe"`. |

### Unsubscribe Response

```json
{
  "message": "Unsubscribed",
  "status": 201,
  "statusCode": "201"
}
```

### Example

```js
const { response } = await Dispatcher.call('/appcd/fswatch', {
	data: {
		path: '/path/to/watch',
		recursive: false
	},
	type: 'subscribe'
});

response.on('data', data => {
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

response.on('end', () => {
	console.log('No longer watching');
});
```

```js
await Dispatcher.call('/appcd/fswatch', {
	sid: '<sid from subscribe event>',
	type: 'unsubscribe'
});
```
