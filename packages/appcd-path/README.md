# appcd-path

Library for working with paths.

Visit https://github.com/appcelerator/appc-daemon for more information.

## Installation

	npm i appcd-path

## Usage

```js
import { expandPath } from 'appcd-path';

// replace ~ with the user's home path and join any additional segments
console.log(expandPath('~/foo', 'bar'));
```

```js
import { real } from 'appcd-nodejs';

// resolves symlinks to real path, even if symlink is broken
console.log(real('/some/path'));
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/appc-daemon/packages/appcd-path/LICENSE
