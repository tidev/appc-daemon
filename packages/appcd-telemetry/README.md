# appcd-telemetry

Library for collecting and sending data to the Appcelerator cloud for
quality and usage analytics.

## Usage

```javascript
import Telemetry from 'appcd-telemetry';

const telemetry = new Telemetry();
telemetry
	.init()
	.then(() => {
		console.log('Ready!');
	});
```
