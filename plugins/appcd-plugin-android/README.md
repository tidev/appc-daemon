# appcd-plugin-android

Android service for the Appc Daemon.

## Info

The `info` service uses [androidlib](https://github.com/appcelerator/androidlib) to detect the
installed Android SDKs, NDKs, emulators, devices, etc and returns the information.

```js
appcd.call('/ios/latest/info', ctx => {
	console.log(ctx.response);
});
```
