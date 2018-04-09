# appcd-machine-id

Determines and caches a unique machine identifier.

Visit https://github.com/appcelerator/appc-daemon for more information.

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
const mid = await getMachineId('~/.appcelerator/appcd/.mid');
console.log(`mid: ${mid}`);
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/appc-daemon/packages/appcd-machine-id/LICENSE
