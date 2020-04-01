# appcd-config

Appc Daemon configuration object.

Visit https://github.com/appcelerator/appc-daemon for more information.

Report issues to [GitHub issues][2]. Official issue tracker in [JIRA][3].

## Installation

	npm i appcd-config

## Usage

```js
import AppcdConfig from 'appcd-config';

const conf = new AppcdConfig({
	data: {
		some: {
			setting: 'value'
		}
	}
});

conf.load('/path/to/js-or-json-file');

conf.get('some.setting');

conf.watch(obj => {
	console.log('config changed!', obj);
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
