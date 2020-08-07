# ![Appc Daemon logo](../images/appc-daemon.png) Daemon Project

## HTTP Clients

The Appc Daemon's web server by default listens on port `1732`. You can request services,
application endpoints, and static resources.

Requests can be made by any HTTP client such as `curl`, a web browser, Node.js "http" module,
`fetch()`, or `XMLHttpRequest`.

Whenever possible, the client should set the `User-Agent` header to the name of the application or
library calling the Appc Daemon.

If the Appc Daemon is not running, it is the responsibility of the calling application to start the
Appc Daemon.

### Security

The Appc Daemon web server only supports HTTP and does __not__ support HTTPS.

Some services do not support requests from HTTP clients such as the
[Subprocess Manager](../Components/Subprocess-Manager.md).

For more information about the Web Server and security, please refer to the
[Web Server](../Components/Web-Server.md) documentation.

### Status Codes

Response status codes are mapped to `appcd-response` codes, which are based on a subset of HTTP
status codes. Internally, response status codes can be a decimal number such as `200.1` where the
decimal part is the "subcode". When the Dispatcher response system detects an HTTP client, the
subcode is stripped from the response status code resulting in a valid HTTP status code.

For more information about Dispatcher status codes, please refer to the
[Dispatcher](../Components/Dispatcher.md) documenation.

### Streamed Responses vs Service Subscriptions

A service or application endpoint may keep the HTTP connection open and continously stream a
response to the client. It will stop when the HTTP client disconnects. An example of this is
[/appcd/logcat](../Services/logcat.md).

Services subscriptions are different. Only [WebSocket](WebSocket.md) and [Node.js](Nodejs.md)
clients can "subscribe" to these services.

### Fetching a Static File Example

```
curl -i http://localhost:1732/index.html
```

Daemon Log:

```
2017-05-15T16:00:15.827Z appcd:http:webserver 127.0.0.1:50527 connected
2017-05-15T16:00:15.836Z appcd:dispatcher trace Searching for route handler: /index.html
2017-05-15T16:00:15.838Z appcd:dispatcher trace Testing route: /appc-cli
2017-05-15T16:00:15.838Z appcd:dispatcher trace Testing route: /appcd
2017-05-15T16:00:15.839Z appcd:dispatcher debug Route not found: /index.html
2017-05-15T16:00:15.850Z appcd:http:webserver 127.0.0.1:50527 GET /index.html 200 15ms
2017-05-15T16:00:15.857Z appcd:http:webserver 127.0.0.1:50527 disconnected
```

Response:

```
HTTP/1.1 200 OK
X-DNS-Prefetch-Control: off
X-Frame-Options: SAMEORIGIN
X-Download-Options: noopen
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Content-Length: 593
Last-Modified: Wed, 22 Feb 2017 19:47:26 GMT
Cache-Control: max-age=0
Content-Type: text/html; charset=utf-8
Date: Mon, 15 May 2017 16:00:15 GMT
Connection: keep-alive

<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<title>Appc Daemon</title>
	<style>
	html {
		height: 100%;
	}

	body {
		align-items: center;
		background: linear-gradient(to bottom, #596a72 0%, #cedce7 100%);
		display: flex;
		justify-content: center;
		height: 100%;
		margin: 0;
		padding: 0;
	}

	h1 {
		background: url(appc-daemon.png) no-repeat left;
		color: #fff;
		font: 64px/100px "Open Sans", sans-serif;
		margin: 0;
		padding-left: 110px;
		text-shadow: 2px 2px 3px #000;
		white-space: nowrap;
	}
	</style>
</head>
<body>
	<h1>Appc Daemon</h1>
</body>
</html>
```

### 404 Example

```
curl -i http://localhost:1732/does_not_exist
```

Daemon Log:

```
2017-05-15T16:01:16.792Z appcd:http:webserver 127.0.0.1:50554 connected
2017-05-15T16:01:16.795Z appcd:dispatcher trace Searching for route handler: /does_not_exist
2017-05-15T16:01:16.795Z appcd:dispatcher trace Testing route: /appc-cli
2017-05-15T16:01:16.795Z appcd:dispatcher trace Testing route: /appcd
2017-05-15T16:01:16.796Z appcd:dispatcher debug Route not found: /does_not_exist
2017-05-15T16:01:16.799Z appcd:http:webserver 127.0.0.1:50554 GET /does_not_exist 404 ENOENT: no such file or directory, stat '/Users/chris/appc/appc-daemon/packages/appcd-core/public/does_not_exist' 4ms
2017-05-15T16:01:16.801Z appcd:http:webserver 127.0.0.1:50554 disconnected
```

Response:

```
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 113
Date: Mon, 15 May 2017 16:01:16 GMT
Connection: keep-alive

ENOENT: no such file or directory, stat '/Users/chris/appc/appc-daemon/packages/appcd-core/public/does_not_exist'
```

### Requesting Daemon Status

```
curl -i http://localhost:1732/appcd/status
```

Daemon Log:

```
2017-05-15T16:10:34.906Z appcd:http:webserver 127.0.0.1:50719 connected
2017-05-15T16:10:34.909Z appcd:dispatcher trace Searching for route handler: /appcd/status
2017-05-15T16:10:34.910Z appcd:dispatcher trace Testing route: /appc-cli
2017-05-15T16:10:34.910Z appcd:dispatcher trace Testing route: /appcd
2017-05-15T16:10:34.910Z appcd:dispatcher trace Found matching route: /appcd
2017-05-15T16:10:34.910Z appcd:dispatcher trace Calling dispatcher handler /appcd
2017-05-15T16:10:34.910Z appcd:dispatcher trace Searching for route handler: /status
2017-05-15T16:10:34.910Z appcd:dispatcher trace Testing route: /config
2017-05-15T16:10:34.911Z appcd:dispatcher trace Testing route: /fs
2017-05-15T16:10:34.911Z appcd:dispatcher trace Testing route: /logcat
2017-05-15T16:10:34.911Z appcd:dispatcher trace Testing route: /plugin
2017-05-15T16:10:34.911Z appcd:dispatcher trace Testing route: /status
2017-05-15T16:10:34.911Z appcd:dispatcher trace Found matching route: /status
2017-05-15T16:10:34.911Z appcd:dispatcher trace Calling dispatcher handler /status
2017-05-15T16:10:34.911Z appcd:dispatcher trace Searching for route handler:
2017-05-15T16:10:34.912Z appcd:dispatcher trace Testing route: /:filter*
2017-05-15T16:10:34.912Z appcd:dispatcher trace Found matching route: /:filter*
2017-05-15T16:10:34.912Z appcd:dispatcher:service-dispatcher Invoking onCall handler: /:filter*
2017-05-15T16:10:34.912Z appcd:http:webserver 127.0.0.1:50719 GET /appcd/status 200 3ms
2017-05-15T16:10:34.914Z appcd:http:webserver 127.0.0.1:50719 disconnected
```

Response:

```
HTTP/1.1 200 OK
X-DNS-Prefetch-Control: off
X-Frame-Options: SAMEORIGIN
X-Download-Options: noopen
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Content-Type: application/json; charset=utf-8
Content-Length: 2381
Date: Mon, 15 May 2017 16:10:34 GMT
Connection: keep-alive

{"pid":41825,"process":{"execPath":"/Users/chris/.axway/appcd/node/v7.10.0/darwin/x64/node","execArgv":["--max_old_space_size=3000"],"argv":["/Users/chris/.axway/appcd/node/v7.10.0/darwin/x64/node","/Users/chris/appc/appc-daemon/packages/appcd-core/dist/main.js"],"env":{"TERM_PROGRAM":"iTerm.app","TERM":"xterm-256color","SHELL":"/bin/bash","CLICOLOR":"1","TMPDIR":"/var/folders/wx/j1v32g355xj28rnt9yb_6hfm0000gn/T/","Apple_PubSub_Socket_Render":"/private/tmp/com.apple.launchd.IX0F5tXSMa/Render","TERM_PROGRAM_VERSION":"3.0.15","TERM_SESSION_ID":"w0t0p0:61A2C6D6-0FBA-412A-AD99-B1E7ECCF3BA8","USER":"chris","COMMAND_MODE":"unix2003","SSH_AUTH_SOCK":"/private/tmp/com.apple.launchd.1afFEqS7FT/Listeners","__CF_USER_TEXT_ENCODING":"0x1F5:0x0:0x0","PATH":"/Users/chris/.yarn/bin:/usr/local/bin:/usr/local/sbin:/opt/local/bin:/opt/local/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/android-sdk/platform-tools:/opt/android-sdk/tools:/usr/local/mysql/bin","PWD":"/Users/chris/appc/appc-daemon","LANG":"en_US.UTF-8","ITERM_PROFILE":"Default","NDK_CCACHE":"/opt/local/bin/ccache","XPC_FLAGS":"0x0","GIT_MERGE_AUTOEDIT":"no","XPC_SERVICE_NAME":"0","SHLVL":"1","HOME":"/Users/chris","COLORFGBG":"7;0","NUM_CPUS":"4","ITERM_SESSION_ID":"w0t0p0:61A2C6D6-0FBA-412A-AD99-B1E7ECCF3BA8","LOGNAME":"chris","ANDROID_NDK":"/opt/android-ndk","SECURITYSESSIONID":"186a8","_":"/usr/local/bin/gulp","OLDPWD":"/Users/chris/appc/appc-daemon/docs","INIT_CWD":"/Users/chris/appc/appc-daemon","APPCD_BOOTSTRAP":"null"}},"node":{"version":"7.10.0","versions":{"http_parser":"2.7.0","node":"7.10.0","v8":"5.5.372.43","uv":"1.11.0","zlib":"1.2.11","ares":"1.10.1-DEV","modules":"51","openssl":"1.0.2k","icu":"58.2","unicode":"9.0","cldr":"30.0.3","tz":"2016j"}},"system":{"platform":"darwin","arch":"x64","cpus":8,"hostname":"yojimbo.local","loadavg":[1.9580078125,1.80517578125,1.75146484375],"memory":{"free":260206592,"total":17179869184}},"version":"1.0.0","fswatch":{"nodes":0,"fswatchers":0,"watchers":0,"tree":"<empty tree>"},"subprocesses":[],"plugins":[{"name":"appcd-plugin-appc-cli","namespace":"appc-cli","version":"1.0.0","path":"/Users/chris/appc/appc-daemon/plugins/appcd-plugin-appc-cli","type":"external","nodeVersion":"7.10.0","pid":null,"module":null,"instance":null,"error":false}],"memory":{"heapTotal":45019136,"heapUsed":40595520,"rss":75497472},"uptime":708.943}
```

### Streamed Responses

Some responses continuously stream output

```
curl -i http://localhost:1732/appcd/logcat
```

Daemon Log:

```
2017-05-15T16:32:31.725Z appcd:http:webserver 127.0.0.1:51384 connected
2017-05-15T16:32:31.732Z appcd:dispatcher trace Searching for route handler: /appcd/logcat
2017-05-15T16:32:31.733Z appcd:dispatcher trace Testing route: /appc-cli
2017-05-15T16:32:31.733Z appcd:dispatcher trace Testing route: /appcd
2017-05-15T16:32:31.733Z appcd:dispatcher trace Found matching route: /appcd
2017-05-15T16:32:31.733Z appcd:dispatcher trace Calling dispatcher handler /appcd
2017-05-15T16:32:31.733Z appcd:dispatcher trace Searching for route handler: /logcat
2017-05-15T16:32:31.733Z appcd:dispatcher trace Testing route: /config
2017-05-15T16:32:31.733Z appcd:dispatcher trace Testing route: /fs
2017-05-15T16:32:31.734Z appcd:dispatcher trace Testing route: /logcat
2017-05-15T16:32:31.734Z appcd:dispatcher trace Found matching route: /logcat
2017-05-15T16:32:31.738Z appcd:http:webserver 127.0.0.1:51384 GET /appcd/logcat 200 7ms
```

Response:

```
HTTP/1.1 200 OK
X-DNS-Prefetch-Control: off
X-Frame-Options: SAMEORIGIN
X-Download-Options: noopen
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Content-Type: application/octet-stream
Date: Mon, 15 May 2017 16:32:31 GMT
Connection: keep-alive
Transfer-Encoding: chunked

2017-05-15T16:24:33.640Z appcd:core:status CPU:    0.4%  Heap:  ↓51.39 MB /   58.43 MB  RSS:  ↑88.14 MB  Uptime: 25.80m
2017-05-15T16:24:35.645Z appcd:core:status CPU:    0.4%  Heap:  ↑51.41 MB /   58.43 MB  RSS:  ↑89.20 MB  Uptime: 25.84m
2017-05-15T16:24:37.645Z appcd:core:status CPU:    0.4%  Heap:  ↑51.44 MB /  ↓55.43 MB  RSS:  ↓86.30 MB  Uptime: 25.87m
<SNIP>
2017-05-15T16:32:26.485Z appcd:core:status CPU:    0.5%  Heap:  ↑58.98 MB /  ↑63.93 MB  RSS:  ↑93.80 MB  Uptime: 33.67m
2017-05-15T16:32:28.490Z appcd:core:status CPU:    0.5%  Heap:  ↑59.45 MB /   63.93 MB  RSS:  ↑94.26 MB  Uptime: 33.71m
2017-05-15T16:32:30.495Z appcd:core:status CPU:    0.5%  Heap:  ↑59.50 MB /   63.93 MB  RSS:  ↑94.32 MB  Uptime: 33.74m
2017-05-15T16:32:31.725Z appcd:http:webserver 127.0.0.1:51384 connected
2017-05-15T16:32:31.732Z appcd:dispatcher trace Searching for route handler: /appcd/logcat
2017-05-15T16:32:31.733Z appcd:dispatcher trace Testing route: /appc-cli
2017-05-15T16:32:31.733Z appcd:dispatcher trace Testing route: /appcd
2017-05-15T16:32:31.733Z appcd:dispatcher trace Found matching route: /appcd
2017-05-15T16:32:31.733Z appcd:dispatcher trace Calling dispatcher handler /appcd
2017-05-15T16:32:31.733Z appcd:dispatcher trace Searching for route handler: /logcat
2017-05-15T16:32:31.733Z appcd:dispatcher trace Testing route: /config
2017-05-15T16:32:31.733Z appcd:dispatcher trace Testing route: /fs
2017-05-15T16:32:31.734Z appcd:dispatcher trace Testing route: /logcat
2017-05-15T16:32:31.734Z appcd:dispatcher trace Found matching route: /logcat
2017-05-15T16:32:31.738Z appcd:http:webserver 127.0.0.1:51384 GET /appcd/logcat 200 7ms
2017-05-15T16:32:32.499Z appcd:core:status CPU:    0.5%  Heap:  ↑61.91 MB /  ↑68.43 MB  RSS:  ↑97.86 MB  Uptime: 33.77m
2017-05-15T16:32:34.504Z appcd:core:status CPU:    0.5%  Heap:  ↓61.57 MB /  ↑68.93 MB  RSS:  ↑98.52 MB  Uptime: 33.81m
```

### Requesting a WebSocket-only Service Endpoint

```
curl -i http://localhost:1732/appcd/subprocess/spawn
```

Daemon Log:

```
2017-05-15T16:34:16.289Z appcd:http:webserver 127.0.0.1:51408 connected
2017-05-15T16:34:16.291Z appcd:dispatcher trace Searching for route handler: /appcd/subprocess/spawn
2017-05-15T16:34:16.291Z appcd:dispatcher trace Testing route: /appc-cli
2017-05-15T16:34:16.292Z appcd:dispatcher trace Testing route: /appcd
2017-05-15T16:34:16.292Z appcd:dispatcher trace Found matching route: /appcd
2017-05-15T16:34:16.292Z appcd:dispatcher trace Calling dispatcher handler /appcd
2017-05-15T16:34:16.292Z appcd:dispatcher trace Searching for route handler: /subprocess/spawn
2017-05-15T16:34:16.293Z appcd:dispatcher trace Testing route: /config
2017-05-15T16:34:16.293Z appcd:dispatcher trace Testing route: /fs
2017-05-15T16:34:16.293Z appcd:dispatcher trace Testing route: /logcat
2017-05-15T16:34:16.293Z appcd:dispatcher trace Testing route: /plugin
2017-05-15T16:34:16.293Z appcd:dispatcher trace Testing route: /status
2017-05-15T16:34:16.294Z appcd:dispatcher trace Testing route: /subprocess
2017-05-15T16:34:16.295Z appcd:dispatcher trace Found matching route: /subprocess
2017-05-15T16:34:16.295Z appcd:dispatcher trace Calling dispatcher handler /subprocess
2017-05-15T16:34:16.295Z appcd:dispatcher trace Searching for route handler: /spawn
2017-05-15T16:34:16.295Z appcd:dispatcher trace Testing route: /spawn/node/:version?
2017-05-15T16:34:16.295Z appcd:dispatcher trace Testing route: /spawn
2017-05-15T16:34:16.296Z appcd:dispatcher trace Found matching route: /spawn
2017-05-15T16:34:16.306Z appcd:dispatcher error SubprocessError: Spawn not permitted (code 403)
2017-05-15T16:34:16.306Z appcd:dispatcher error     at Promise (/Users/chris/appc/appc-daemon/packages/appcd-subprocess/dist/subprocess-manager.js:52:12)
2017-05-15T16:34:16.306Z appcd:dispatcher error     at Object.SubprocessManager.d.dispatcher._appcdDispatcher2.default.register.register [as handler] (/Users/chris/appc/appc-daemon/packages/appcd-subprocess/dist/subprocess-manager.js:49:31)
2017-05-15T16:34:16.306Z appcd:dispatcher error     at h.handler.Promise (/Users/chris/appc/appc-daemon/packages/appcd-dispatcher/dist/dispatcher.js:148:24)
2017-05-15T16:34:16.306Z appcd:dispatcher error     at f (/Users/chris/appc/appc-daemon/packages/appcd-dispatcher/dist/dispatcher.js:145:11)
2017-05-15T16:34:16.306Z appcd:dispatcher error     at f (/Users/chris/appc/appc-daemon/packages/appcd-dispatcher/dist/dispatcher.js:124:12)
2017-05-15T16:34:16.306Z appcd:dispatcher error     at Promise.resolve.then (/Users/chris/appc/appc-daemon/packages/appcd-dispatcher/dist/dispatcher.js:174:16)
2017-05-15T16:34:16.306Z appcd:dispatcher error -------------------------------------------------
2017-05-15T16:34:16.306Z appcd:dispatcher error     at Object.SubprocessManager.d.dispatcher._appcdDispatcher2.default.register.register [as handler] (/Users/chris/appc/appc-daemon/packages/appcd-subprocess/dist/subprocess-manager.js:49:31)
2017-05-15T16:34:16.306Z appcd:dispatcher error     at h.handler.Promise (/Users/chris/appc/appc-daemon/packages/appcd-dispatcher/dist/dispatcher.js:148:24)
2017-05-15T16:34:16.306Z appcd:dispatcher error     at f (/Users/chris/appc/appc-daemon/packages/appcd-dispatcher/dist/dispatcher.js:145:11)
2017-05-15T16:34:16.306Z appcd:dispatcher error     at f (/Users/chris/appc/appc-daemon/packages/appcd-dispatcher/dist/dispatcher.js:124:12)
2017-05-15T16:34:16.306Z appcd:dispatcher error     at Promise.resolve.then (/Users/chris/appc/appc-daemon/packages/appcd-dispatcher/dist/dispatcher.js:174:16)
2017-05-15T16:34:16.306Z appcd:dispatcher error -------------------------------------------------
2017-05-15T16:34:16.306Z appcd:dispatcher error     at f (/Users/chris/appc/appc-daemon/packages/appcd-dispatcher/dist/dispatcher.js:145:11)
2017-05-15T16:34:16.306Z appcd:dispatcher error     at f (/Users/chris/appc/appc-daemon/packages/appcd-dispatcher/dist/dispatcher.js:124:12)
2017-05-15T16:34:16.306Z appcd:dispatcher error     at Promise.resolve.then (/Users/chris/appc/appc-daemon/packages/appcd-dispatcher/dist/dispatcher.js:174:16)
2017-05-15T16:34:16.306Z appcd:dispatcher error -------------------------------------------------
2017-05-15T16:34:16.306Z appcd:dispatcher error     at a.call (/Users/chris/appc/appc-daemon/packages/appcd-dispatcher/dist/dispatcher.js:174:5)
2017-05-15T16:34:16.306Z appcd:dispatcher error     at f (/Users/chris/appc/appc-daemon/packages/appcd-dispatcher/dist/dispatcher.js:142:26)
2017-05-15T16:34:16.306Z appcd:dispatcher error     at f (/Users/chris/appc/appc-daemon/packages/appcd-dispatcher/dist/dispatcher.js:124:12)
2017-05-15T16:34:16.306Z appcd:dispatcher error     at f (/Users/chris/appc/appc-daemon/packages/appcd-dispatcher/dist/dispatcher.js:124:12)
2017-05-15T16:34:16.306Z appcd:dispatcher error     at f (/Users/chris/appc/appc-daemon/packages/appcd-dispatcher/dist/dispatcher.js:124:12)
2017-05-15T16:34:16.306Z appcd:dispatcher error     at f (/Users/chris/appc/appc-daemon/packages/appcd-dispatcher/dist/dispatcher.js:124:12)
2017-05-15T16:34:16.306Z appcd:dispatcher error     at f (/Users/chris/appc/appc-daemon/packages/appcd-dispatcher/dist/dispatcher.js:124:12)
2017-05-15T16:34:16.306Z appcd:dispatcher error     at Promise.resolve.then (/Users/chris/appc/appc-daemon/packages/appcd-dispatcher/dist/dispatcher.js:174:16)
2017-05-15T16:34:16.310Z appcd:http:webserver 127.0.0.1:51408 GET /appcd/subprocess/spawn 403 19ms
2017-05-15T16:34:16.312Z appcd:http:webserver 127.0.0.1:51408 disconnected
```

Response:

```
HTTP/1.1 403 Forbidden
X-DNS-Prefetch-Control: off
X-Frame-Options: SAMEORIGIN
X-Download-Options: noopen
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Content-Type: text/plain; charset=utf-8
Content-Length: 47
Date: Mon, 15 May 2017 16:34:16 GMT
Connection: keep-alive

SubprocessError: Spawn not permitted (code 403)
```
