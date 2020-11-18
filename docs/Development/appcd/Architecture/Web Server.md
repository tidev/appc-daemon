> [Home](../../../README.md) ➤ [Development](../../README.md) ➤ [Appc Daemon Development](../README.md) ➤ [Architecture](README.md) ➤ Web Server

> :warning: Under construction.

# Web Server

The Appc Daemon uses a [Koa.js](http://koajs.com/) web server to accept incoming HTTP and WebSocket
requests. By default, the web server listens on `localhost` only. It only HTTP and does __not__
support HTTPS.

By default, the web server only accepts incoming requests from `localhost`.

Incoming HTTP requests are transformed via a Appc Daemon's custom Koa middleware into a Dispatcher
request. Some services such as the [Subprocess Manager](Subprocess-Manager.md) do not permit
requests over HTTP.

WebSocket sessions are handled a bit differently. When an HTTP connection is upgraded to a
WebSocket, the client can make multiple simultaneous requests over the WebSocket and the daemon will
route them through the dispatcher. It's up to the client to pair the response with the request. If a
client disconnects, the WebSocket session is invalidated. It's worth noting that the
[appcd-client](../Clients/Nodejs.md) uses a WebSocket for all requests.

When a request has exhausted all dispatcher routes, Koa will continue to route the request to other
middlewares such as the static file server. If no route is matched, a "404 not found" error is
returned.

For Dispatcher handlers that support "call" requests, a request can be made via either HTTP or a
WebSocket. It's possible for a "call" request to return a streamed response, though it is expected
that the stream end at some point. Subscription requests can only be made over a WebSocket.

### Security

The Appc Daemon's web server comes equipped with
[koa-helmet](https://www.npmjs.com/package/koa-helmet). Helmet provides a series of middlewares that
sets a number of HTTP headers to help secure the Appc Daemon.
