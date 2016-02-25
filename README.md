# appc.daemon

Prototype for the new daemon design

## Installation

	npm install
	sudo npm link

## Quick Start

Start the server:

	appcd start

Start the server in debug mode:

	appcd start --debug

Stop the server:

	appcd stop

For fast development iteration:

	gulp watch

	# or

	npm run watch

Query the status of the server:

	appcd status

View server log output:

	appcd logcat

## Configuration

appcd is designed to use sensible defaults. However, to override these defaults
appcd supports loading a a CommonJS formatted JavaScript file:

	~/.appcelerator/appcd.js

Example:

```javascript
module.exports = {
	logger: {
		colors: true,
		silent: false
	},
	paths: {
		plugins: [
			'/path/to/a/plugin'
		]
	}
};
```

## API Documentation

To generate API docs into static HTML files, run:

	gulp docs

Currently, esdoc does not support ES7 features, so API docs for constructs such
as class properties are ignored.

## API

appcd is both a server and a client. You can programmatically control the appcd
server. You can also use the client library to issue requests to the appcd
server.

```javascript
import { Client } from 'appcd';

const client = new Client();
client
	.request('/appcd/status')
	.on('response', status => {
		console.log(status);
		client.disconnect();
	})
	.on('error', err => {
		console.error('ERROR!');
		console.error(err);
	});
```

## WebSocket Protocol

Any WebSocket capable platform can connect to appcd as long as it follows the
appcd protocol.

Each request must be a serialized JSON object that contains a `version`, `id`,
`path`, and optionally a `data` payload.

The following is an example of a web browser that issues a status request:

```javascript
var ws = new WebSocket('ws://127.0.0.1:1732');
ws.onopen = function () {
	ws.onmessage = function (evt) {
		console.log('Got status!');
		console.log(evt.data);
		ws.close();
	};

	ws.send(JSON.stringify({
		version: '1.0',
		path: '/appcd/status',
		id: '123456',
		data: { interval: 2000 }
	}));
};
```

## Architecture

The appcd server is designed to run as a detached background process. Basic
operations are performed using the `appcd` CLI.

Internally, the appcd server uses a web server to facilitate requests over HTTP
and via WebSockets. The service endpoints can register themselves to respond to
either protocol, however there are some implementation differences.

HTTP requests flow through the Koa.js web application framework and use a
traditional router API that supports REST API requests as well as static file
serving.

WebSocket requests use a custom protocol and the requests are handled by a
dispatcher. This dispatcher allows endpoints to register request handlers.
The dispatcher supports nested dispatchers which is used for plugin namespace
scoped dispatchers. Additionally, the WebSocket interface allows bi-directional
communication between the server and client. This enables the server to "stream"
data to the client such as log output.

## Logger

appcd uses a custom logger that supports output buffering, streaming, and
colored output.

When the logger is written to, the output is buffered as well as piped to all
registered writable streams.

The output may contain ANSI color sequences. The colors are only stripped when
being piped to an output stream that explicitly does not support colors.

## Service Plugins

Service plugins allow you to add new services to the appc daemon. The appc
daemon will load and initialize them. Services must use the API defined by
the "appcd" module in order for things to work.
