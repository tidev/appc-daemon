# ![Appc Daemon logo](../../images/appc-daemon.png) Daemon Project

## Web Server

Koa.js

The Appc Daemon web server only supports HTTP and does __not__ support HTTPS.

By default, the web server only accepts incoming requests from `localhost`.

https://www.npmjs.com/package/koa-helmet

The Appc Daemon uses a Koa.js web server to accept incoming HTTP and WebSocket requests. By default, the web server listens on localhost only.

Incoming HTTP requests are transformed via a Koa middleware into a Dispatcher request. Some services such as the Subprocess Manager do not permit requests over HTTP.

WebSocket sessions are handled a bit differently. When an HTTP connect is upgraded to a WebSocket, a client can make multiple simultaneous requests over the WebSocket and the daemon will route them through the dispatcher. It's up to the client to pair the response with the request. If a client disconnects, the WebSocket session is invalidated. It's worth noting that the appcd-client uses a WebSocket for all requests.

When a request has exhausted all dispatcher routes, Koa will continue to route the request to other middlewares such as the static file server. If no route is matched, a "404 not found" error is returned.

For Dispatcher handlers that support a single response, a request can be made via either HTTP and a WebSocket. It's possible for a single response to be a streamed response, though it is expected that the stream end at some point. Subscription requests can only be made over a WebSocket.
