# appcd-logger

Defines the default logger for appcd components. The primary benefits of this package is to create a
single default configured logger and only have a single
[SnoopLogg](https://www.npmjs.com/package/snooplogg) dependency since it carries a hefty size on
disk.

Visit https://github.com/appcelerator/appc-daemon for more information.

## Installation

	npm i appcd-logger

## Usage

```js
import appcdLogger from 'appcd-logger';

const logger = appcdLogger('my:namespace');

logger.info('hi');
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/appc-daemon/blob/master/packages/appcd-logger/LICENSE
