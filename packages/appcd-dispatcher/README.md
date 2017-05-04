# appcd-dispatcher

Provides an HTTP-like API for exposing services.

## Usage

```javascript
import Dispatcher from 'appcd-dispatcher';

const dispatcher = new Dispatcher();

dispatcher.register('/foo/:id?', req => {
	if (req.params.id) {
		return {
			message: `hello ${req.params.id}`
		};
	}

	return {
		message: 'hello guest!'
	};
});

// 200
dispatcher
	.call('/foo')
	.then(result => {
		console.log('Response:', result);
	})
	.catch(console.error);

// 200 with parameter
dispatcher
	.call('/foo/123')
	.then(result => {
		console.log('Response:', result);
	})
	.catch(console.error);

// 404
dispatcher
	.call('/bar')
	.catch(console.error);
```
