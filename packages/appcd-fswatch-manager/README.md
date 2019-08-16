# appcd-fswatch-manager

Filesystem watcher service for the Appc Daemon.

Visit https://github.com/appcelerator/appc-daemon for more information.

Report issues to [GitHub issues][2]. Official issue tracker in [JIRA][3].

## Installation

	npm i appcd-fswatch-manager

## Usage

```js
import FSWatchManager from 'appcd-fswatch-manager';
import Dispatcher from 'appcd-dispatcher';

const manager = new FSWatchManager();

Dispatcher.register('/fswatch', manager);

const ctx = await Dispatcher.call('/fswatch', {
	data: {
		path: '/some/path/to/watch',
		recursive: true,
		depth: 2
	},
	type: 'subscribe'
});

console.log(ctx.response);
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/appc-daemon/blob/master/packages/appcd-fswatch-manager/LICENSE
[2]: https://github.com/appcelerator/appc-daemon/issues
[3]: https://jira.appcelerator.org/projects/DAEMON/issues
