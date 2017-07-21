# appcd-config

Library for config files with metadata.

## Usage

```javascript
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
