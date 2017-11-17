# appcd-plugin-windows

Windows service for the Appc Daemon.

## Info

The `info` service uses [windowslib](https://github.com/appcelerator/windowslib) to detect the installed
Windows information and returns the information.

```js
appcd.call('/windows/latest/info', ctx => {
	console.log(ctx.response);
});
```


You're probably wondering where the windowslib dependency is. It's in appcd-core due to the max path issues explained in [DAEMON-162](https://jira.appcelerator.org/browse/DAEMON-162), which will be fixed in [DAEMON-165](https://jira.appcelerator.org/browse/DAEMON-165)
