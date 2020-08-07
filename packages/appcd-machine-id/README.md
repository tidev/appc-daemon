# appcd-machine-id

Determines and caches a unique machine identifier.

Visit https://github.com/appcelerator/appc-daemon for more information.

Report issues to [GitHub issues][2]. Official issue tracker in [JIRA][3].

## Installation

	npm i appcd-machine-id

## Usage

```js
import getMachineId from 'appcd-machine-id';

const mid = await getMachineId();
console.log(`mid: ${mid}`);
```

If you want to persist the machine id, pass in a path to the `.mid` file.

```js
const mid = await getMachineId('~/.axway/appcd/.mid');
console.log(`mid: ${mid}`);
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/appc-daemon/blob/master/packages/appcd-machine-id/LICENSE
[2]: https://github.com/appcelerator/appc-daemon/issues
[3]: https://jira.appcelerator.org/projects/DAEMON/issues
