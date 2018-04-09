# appcd-fswatcher

A filesystem watcher that actually works.

Visit https://github.com/appcelerator/appc-daemon for more information.

## Installation

	npm i appcd-fswatcher

## Usage

```js
import FSWatcher from 'appcd-fswatcher';

const watcher = new FSWatcher('/path/to/watch', {
	recursive: true,
	depth: 2
});

watcher.on('change', evt => {
	console.log(evt);
});

watcher.on('error', err => {
	console.error(err);
});
```

To stop watching, you can call `close()`:

```js
watcher.close();
```

Extra functions:

```js
import {
	renderTree,
	status
} from 'appcd-fswatcher';

// display an ascii tree of the filesystem tree that's being watched
console.log(renderTree());

// display filesystem watcher stats (as well as the tree)
console.log(status());
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/appc-daemon/packages/appcd-fswatcher/LICENSE
