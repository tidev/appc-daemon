# appcd-subprocess-manager

Appc Daemon subprocess service.

Visit https://github.com/appcelerator/appc-daemon for more information.

Report issues to [GitHub issues][2]. Official issue tracker in [JIRA][3].

## Installation

	npm i appcd-subprocess-manager

## Usage

```js
import SubprocessManager from 'appcd-subprocess-manager';

const manager = new SubprocessManager();
Dispatcher.register('/subprocess', manager);

const ctx = await Dispatcher.call('/subprocess/spawn', {
	args: [ process.execPath, '--version' ]
});

console.log(ctx.response);
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/appc-daemon/blob/master/packages/appcd-subprocess-manager/LICENSE
[2]: https://github.com/appcelerator/appc-daemon/issues
[3]: https://jira.appcelerator.org/projects/DAEMON/issues
