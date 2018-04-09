# appcd-nodejs

Library for installing, managing, and spawning Node.js.

Visit https://github.com/appcelerator/appc-daemon for more information.

## Installation

	npm i appcd-nodejs

## Usage

```js
import { spawnNode } from 'appcd-nodejs';

const child = await spawnNode({
	arch: undefined, // undefined to auto select, 'x86', or 'x64'
	args: [ '/path/to/some/file.js' ],
	detached: false,
	nodeHome: '/path/to/where/node/versions/are/stored',
	nodeArgs: [], // Node options to pass in before the `args`
	stdio: 'inherit', // can also be 'ignore' or whatever `spawn()` accepts
	v8mem: 'auto', // 'auto' sets the Node's v8 max memory limit to 50% total memory or max of 3 GB
	version: '8.11.1' // exact Node version to use
});

child.on('close', code => {
	console.log(`Process exited: ${code}`);
});
```

If the specified version of Node.js is not installed, it will download it and store the Node
executable in the specified `nodeHome`.

By default, appcd-nodejs will use the Node.js version based on your machine's architecture. You can
override this and explicitly pass in the `arch` option with a value of `x86` or `x64`.

Everytime `spawnNode()` is called, it timestamps when the Node executable was run. Over time,
serveral versions of Node may be installed. appcd-nodejs provides a purge function to remove old
versions.

```js
import { purgeUnusedNodejsExecutables } from 'appcd-nodejs';

const purged = purgeUnusedNodejsExecutables({
	maxAge: 90 * 24 * 60 * 60 * 1000, // max Node age in milliseconds (example is 90 days)
	nodeHome: '/path/to/where/node/versions/are/stored'
});

console.log(purged);
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/appc-daemon/blob/master/packages/appcd-nodejs/LICENSE
