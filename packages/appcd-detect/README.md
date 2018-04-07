# appcd-detect

A engine for detecting and watching filesystem directories for things of interest.

The detect engine is not suitable for detecting individual files. It is intended for detecting if a
specific directory is what you're looking for.

Visit https://github.com/appcelerator/appc-daemon for more information.

## Installation

	npm i appcd-detect

## Usage

```js
import DetectEngine from 'appcd-detect';

const engine = new DetectEngine({
	checkDir(dir) {
	 	if (dir === '/something/we/are/interested/in') {
			return {
				dir
			};
		}
	},
	depth:     1,
	multiple:  true,
	paths:     '/some/path/to/scan',
	redetect:  true,
	watch:     true
});

engine.on('results', results => {
	console.log(results);
});

const results = await engine.start();
console.log(results);
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/appc-daemon/packages/appcd-detect/LICENSE
