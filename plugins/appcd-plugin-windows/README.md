# appcd-plugin-jdk

JDK service for the Appc Daemon.

## Info

The `info` service uses [jdklib](https://github.com/appcelerator/jdklib) to detect the installed
JDKs and returns the information.

```js
appcd.call('/jdk/latest/info', ctx => {
	console.log(ctx.response);
});
```
