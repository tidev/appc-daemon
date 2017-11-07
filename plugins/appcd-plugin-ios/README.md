# appcd-plugin-ios

iOS service for the Appc Daemon.

## Info

The `info` service uses [ioslib2](https://github.com/appcelerator/ioslib2) to detect the installed
Xcodes, Simulators, certs, etc and returns the information.

```js
appcd.call('/ios/latest/info', ctx => {
	console.log(ctx.response);
});
```
