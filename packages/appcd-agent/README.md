# appcd-agent

Monitors a Node.js process and tracks CPU usage, memory usage, and custom metrics.

Visit https://github.com/appcelerator/appc-daemon for more information.

Report issues to [GitHub issues][2]. Official issue tracker in [JIRA][3].

## Installation

	npm i appcd-agent

## Usage

```js
import Agent from 'appcd-agent';

const agent = new Agent({
	pollInterval: 1000 // default
});

agent.on('stats', stats => {
	console.log(stats);
});

// add a custom async or sync data collector that returns an object
agent.addCollector(async () => {
	return {
		mydata: await fetchData();
	};
});

// start the polling loop
agent.start();
```

Get a snapshot of the collected data:

```js
const data = agent.health();
console.log(data);
```

Stop the agent:

```js
agent.stop();
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/appc-daemon/blob/master/packages/appcd-agent/LICENSE
[2]: https://github.com/appcelerator/appc-daemon/issues
[3]: https://jira.appcelerator.org/projects/DAEMON/issues
