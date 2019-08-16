# appcd-fswatcher

A filesystem watcher that actually works.

Visit https://github.com/appcelerator/appc-daemon for more information.

Report issues to [GitHub issues][2]. Official issue tracker in [JIRA][3].

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

[1]: https://github.com/appcelerator/appc-daemon/blob/master/packages/appcd-fswatcher/LICENSE
[2]: https://github.com/appcelerator/appc-daemon/issues
[3]: https://jira.appcelerator.org/projects/DAEMON/issues
