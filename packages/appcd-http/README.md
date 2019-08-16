# appcd-http

Simple HTTP server with WebSocket support, router, and various common middlewares.

Built on top [Koa.js](http://koajs.com/).

Visit https://github.com/appcelerator/appc-daemon for more information.

Report issues to [GitHub issues][2]. Official issue tracker in [JIRA][3].

## Installation

	npm i appcd-config

## Usage

```js
import WebServer from 'appcd-http';

const server = new WebServer({
	hostname: '127.0.0.1',
	port: 8080,
	webroot: '/path/to/webroot'
});

server.on('websocket', (conn, req) => {
	console.log('New WebSocket connection');
});

await server.listen();
console.log('Server started');
```

Add middleware with the `use()` method.

```js
server.use(someMiddleware);
```

To stop the web server:

```js
await server.shutdown();
console.log('Server stopped');
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/appc-daemon/blob/master/packages/appcd-http/LICENSE
[2]: https://github.com/appcelerator/appc-daemon/issues
[3]: https://jira.appcelerator.org/projects/DAEMON/issues
