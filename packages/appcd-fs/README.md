# appcd-fs

Library of useful filesystem functions.

Visit https://github.com/appcelerator/appc-daemon for more information.

Report issues to [GitHub issues][2]. Official issue tracker in [JIRA][3].

## Installation

	npm i appcd-fs

## Usage

Generally you would only import the functions you need.

```js
import {
	existsSync,
	isDir,
	isFile,
	locate
} from 'appcd-fs';

console.log(existsSync('/path/to/something'));

console.log(isDir('/path/to/some/dir'));

console.log(isFile('/path/to/some/file'));

// recursively search a directory for a file up to a specified depth
console.log(locate('/path/to/some/dir', 'somefile', 2));
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/appc-daemon/blob/master/packages/appcd-fs/LICENSE
[2]: https://github.com/appcelerator/appc-daemon/issues
[3]: https://jira.appcelerator.org/projects/DAEMON/issues
