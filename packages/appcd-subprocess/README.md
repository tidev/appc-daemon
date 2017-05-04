# appcd-subprocess

Library for spawning subprocesses.

## Usage

```javascript
import { run } from 'appcd-subprocess';

run('ls', ['-la'], { cwd: '/' })
	.then(({ stdout, stderr }) => {
		console.log(stdout);
	})
	.catch(console.error(err));
```

```javascript
import { which } from 'appcd-subprocess';

which('ls')
	.then(executable => {
		console.log(`Found it: ${executable}`);
	})
	.catch(console.error(err));
```
