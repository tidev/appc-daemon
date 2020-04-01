# appcd-plugin

A complete plugin system for the Appc Daemon.

Visit https://github.com/appcelerator/appc-daemon for more information.

Report issues to [GitHub issues][2]. Official issue tracker in [JIRA][3].

## Installation

	npm i appcd-plugin

## Usage

```javascript
import PluginManager from 'appcd-plugin';
import Dispatcher from 'appcd-dispatcher';

const pm = new PluginManager();

Dispatcher.register('/plugin', pm);

await Dispatcher.call('/plugin/register', { path: '/path/to/myplugin' });

const ctx = await Dispatcher.call('/myplugin/latest');
console.log(ctx.response);
```

```js
await pm.shutdown();
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/appc-daemon/blob/master/packages/appcd-plugin/LICENSE
[2]: https://github.com/appcelerator/appc-daemon/issues
[3]: https://jira.appcelerator.org/projects/DAEMON/issues
