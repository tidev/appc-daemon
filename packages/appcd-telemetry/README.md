# appcd-telemetry

An Appc Daemon service for queuing and sending data to the Axway Appcelerator cloud for quality and
usage analysis. This service itself does not collect the data. It simply stores the events on disk,
sends the events to the cloud, then removes the events.

Visit https://github.com/appcelerator/appc-daemon for more information.

Report issues to [GitHub issues][2]. Official issue tracker in [JIRA][3].

## Installation

	npm i appcd-telemetry

## Usage

```js
import Telemetry from 'appcd-telemetry';
import Config from 'appcd-config';
import Dispatcher from 'appcd-dispatcher';

const cfg = new Config({
	telemetry: {
		guid: 'app guid goes here'
	}
});

const telemetry = new Telemetry(cfg);
await telemetry.init();

Dispatcher.register('/telemetry', telemetry);

Dispatcher.call('/telemetry', {
	event: 'something important', // required
	foo: 'bar'
	// additional data
});
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/appc-daemon/blob/master/packages/appcd-telemetry/LICENSE
[2]: https://github.com/appcelerator/appc-daemon/issues
[3]: https://jira.appcelerator.org/projects/DAEMON/issues
