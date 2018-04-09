# appcd-config

Library for config files with metadata.

Visit https://github.com/appcelerator/appc-daemon for more information.

## Installation

	npm i appcd-config

## Usage

```js
import Config from 'appcd-config';

const conf = new Config({
	config: {
		some: {
			setting: 'value'
		}
	},
	configFile: '/path/to/js-or-json-file'
});

conf.get('some.setting');

conf.on('change', () => {
	console.log('config changed!');
});

conf.set('some.setting', 'another value');
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/appc-daemon/blob/master/packages/appcd-config/LICENSE
