# appc.daemon

Prototype for the new daemon design

## Installation

```
npm install
sudo npm link
```

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
npm run watch
# or
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

## Service Plugins

Service plugins allow you to add new services to the appc daemon. The appc
daemon will load them and wire them up. Services must use the API defined by
the "appcd" module in order for things to work.

```
npm run watch
# or
gulp watch
```
