# appcd-machine-id

Determines and caches a unique machine identifier.

## Usage

```javascript
import { getMachineId } from 'appcd-machine-id';

getMachineId()
	.then(mid => {
		console.log(`mid: ${mid}`);
	})
	.catch(console.error);
```

```javascript
import { getMachineId } from 'appcd-machine-id';

getMachineId('~/.appcelerator/appcd/.mid')
	.then(mid => {
		console.log(`mid: ${mid}`);
	})
	.catch(console.error);
```
