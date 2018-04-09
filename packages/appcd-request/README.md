# appcd-request

Wrapper around [request](https://npmjs.org/package/request) that applies Appc Daemon configuration
when making HTTP requests.

Visit https://github.com/appcelerator/appc-daemon for more information.

## Installation

	npm i appcd-request

## Usage

Refer to the [request](https://npmjs.org/package/request) package's documentation for information
about the supported options.

```js
import request from 'appcd-request';

// `req` is the actual `request` object returned by `request` package
const req = await request({
	url: 'http://127.0.0.1:1337'
	// additional `request` options
}, (err, res, body) => {
	if (err) {
		console.error(err);
	} else {
		console.log(req.statusCode);
		console.log(body);
	}
});

req.on('data', chunk => {
	console.log(`Received ${chunk.length} bytes`);
});
```

### Environment Variables

#### `APPCD_NETWORK_CA_FILE`

Path to a certificate authority file to use to validate the web server's certificate.

#### `APPCD_NETWORK_PROXY`

The proxy server URL to use for the request.

#### `APPCD_NETWORK_STRICT_SSL`

By default, SSL validation is not strict. Setting this environment variable to anything other than
`"false"` will enable strict SSL validation.

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/appc-daemon/blob/master/packages/appcd-request/LICENSE
