# appcd-config-service

Appc Daemon service for managing the appcd configuration.

Visit https://github.com/appcelerator/appc-daemon for more information.

## Installation

	npm i appcd-config-service

## Usage

```js
import ConfigService from 'appcd-config-service';
import Config from 'appcd-config';
import Dispatcher from 'appcd-dispatcher';

const cfg = new Config({ config: { foo: 'bar' } });
const svc = new ConfigService(cfg);

Dispatcher.register('/some/path', svc);

const ctx = await Dispatcher.call('/some/path');
console.log(ctx.response);
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/appc-daemon/blob/master/packages/appcd-config-service/LICENSE
