# appcd-config

Library for config files with metadata.

Visit https://github.com/appcelerator/appc-daemon for more information.

Report issues to [GitHub issues][2]. Official issue tracker in [JIRA][3].

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
[2]: https://github.com/appcelerator/appc-daemon/issues
[3]: https://jira.appcelerator.org/projects/DAEMON/issues
