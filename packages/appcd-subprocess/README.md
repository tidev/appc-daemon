# appcd-subprocess

Appc Daemon service and library for spawning subprocesses.

Visit https://github.com/appcelerator/appc-daemon for more information.

## Installation

	npm i appcd-subprocess

## Usage

```js
import SubprocessManager from 'appcd-subprocess';

const manager = new SubprocessManager();
Dispatcher.register('/subprocess', manager);

const ctx = await Dispatcher.call('/subprocess/spawn', {
	args: [ process.execPath, '--version' ]
});

console.log(ctx.response);
```

```js
import { run } from 'appcd-subprocess';

const { stdout, stderr } = await run('ls', ['-la'], { cwd: '/' });

console.log(stdout);
console.log(stderr);
```

```js
import { spawn } from 'appcd-subprocess';

const child = spawn({
	command: process.execPath,
	args: [ '--version' ],
	options: { cwd: '/' }
});

child.on('close', code => {
	console.log(`Process exited: ${code}`);
});
```

```js
import { which } from 'appcd-subprocess';

const executable = await which('ls');
console.log(`Found it: ${executable}`);
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/appc-daemon/packages/appcd-subprocess/LICENSE
