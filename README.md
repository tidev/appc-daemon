# appc.daemon

Prototype for the new daemon design

## Quick Start

Start the server:

```
appcd start
```

Start the server in debug mode:

```
appcd start --debug
```

Stop the server:

```
appcd stop
```

For fast development iteration:

```
gulp watch
```

## API

```javascript
var Client = require('appcd').Client;

new Client()
	.request('/status')
	.then(function (status) {
		console.info(status);
	})
	.catch(function (err) {
		console.error('ERROR!');
		console.error(err);
	});
```

> NOTE: The client will automatically start the server if it's not already running.
