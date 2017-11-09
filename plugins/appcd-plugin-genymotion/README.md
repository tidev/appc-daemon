# appcd-plugin-genymoton

Genymotion service for the Appc Daemon.

## Info

The `info` service uses [genymotion.js](./src/genymotion.js) and [virtualbox.js](./src/virtualbox.js) to detect the install Genymotion install and emulators, and Virtualbox install.

```js
appcd.call('/genymotion/latest/info', ctx => {
	console.log(ctx.response);
});
```

## Example response
```json
{
    "home": "/Users/eharris/.Genymobile/Genymotion",
    "path": "/Applications/Genymotion.app/Contents/MacOS",
    "emulators": [
        {
            "name": "Custom Phone - 7.1.0 - API 25 - 768x1280",
            "guid": "6dc3f69a-c387-4dfa-9a42-a24a0f2cdb16",
            "target": "7.1.0",
            "sdk-version": "7.1.0",
            "genymotion": "2.11.0",
            "dpi": 320,
            "display": "768x1280-16",
            "abi": "x86",
            "googleApis": null
        }
    ],
    "executables": {
        "genymotion": "/Applications/Genymotion.app/Contents/MacOS/genymotion",
        "player": "/Applications/Genymotion.app/Contents/MacOS/player.app/Contents/MacOS/player"
    },
    "virtualbox": {
        "version": "5.1.26r117224",
        "executables": {
            "vboxmanage": "/usr/local/bin/vboxmanage"
        }
    }
}
```
