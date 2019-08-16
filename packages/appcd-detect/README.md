# appcd-detect

A engine for detecting and watching filesystem directories for things of interest.

The detect engine is not suitable for detecting individual files. It is intended for detecting if a
specific directory is what you're looking for.

Visit https://github.com/appcelerator/appc-daemon for more information.

Report issues to [GitHub issues][2]. Official issue tracker in [JIRA][3].

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

## Windows Registry

On Windows machines, there may be times where the list of paths to scan is derived based on values
in the Windows Registry or the search paths should be rescanned when activity occurs in the
registry. The `DetectEngine` supports this via the `registryCallback` and `registryKeys` options.

### `registryCallback`

A callback that is fired every `refreshPathsInterval` milliseconds when the `watch` option is set
to `true`. By default, `refreshPathsInterval` is set to `30000` (30 seconds).

`registryCallback` is supplied a reference to the `DetectEngine`.

`registryCallback` must return either a falsey value, an object containing `paths` and
`defaultPath`, or a `Promise` that resolves the aforementioned object.

`paths` may be a string, an array of strings, or falsey.

`defaultPath` must be a string or falsey. It is assumed the `defaultPath` is already in the list of
`paths`.

```js
new DetectEngine({
	checkDir(dir) {},
	async registryCallback(engine) {
		// do something
		return {
			paths: [ '/path/to/somewhere' ],
			defaultPath: '/path/to/somewhere' // or `undefined` to autoselect the first path
		};
	},
	watch: true
});
```

If the list of `paths` changes, then it triggers a rescan. If `paths` has not changed since last
called, but `defaultPath` has changed, then only the cached results are processed again. If neither
the `paths` or `defaultPath` has changed, then no action is taken.

### `registryKeys`

This option contains an array of registry watch parameters.

```js
new DetectEngine({
	checkDir(dir) {},
	registryKeys: [
		{
			key: 'HKLM\\SOFTWARE\\Android Studio',
			value: 'SdkPath'
		},
		{
			key: 'HKLM\\Software\\Microsoft\\Microsoft SDKs\\Windows'
			// depth (Number, defaults to 0)
			// filter (Object w/ `subkeys` and/or `values` filters)
			// transform() (Function)
			// value (String)
		}
	],
	watch: true
});
```

The registry watcher will watch the specified keys for changes such as the key itself being
created, a new subkey, or a new value name. It also supports recursively watching key activity.

A `key` may specify the `hive` separate from the `key`, however the detect engine will just combine
them.

If a `value` name is present, it will collect each value and add them to the list of search paths.

During the detect engine startup, the registry key watchers are initialized and each key is
queried and its value added to the list of search paths.

Optionally, each key may contain a `transform()` callback which is invoked on the `value`. If the
result is `undefined`, then the original value argument is used. `transform()` must return an
object with a `value` property, but may also have additional properties such as an `isDefault`
flag.

The `depth` specifies how many subkeys deep it should watch for changes. Defaults to zero.

The `filter` property is an object with `values` and/or `subkeys` containing a string or regex.
Filtering only applies to the existence of subkeys and value "names", but not actual value
"values" or the specified value's "value".

#### `registryKeys` Examples

```js
{
	key: 'HKLM\\SOFTWARE\\Android Studio',
	value: 'SdkPath'
}
```

```js
{
	callback(state, keyWatcher) {
		// `state.value` contains the registry key value

		// if needed, you can use `keyWatcher.winreglib.get()` to fetch additional info

		// optionally, you can set `state.isDefault` to help the detect engine prioritize results

		return state; // optional
	},
	key: 'HKLM\\SOFTWARE\\Android Studio',
	value: 'SdkPath'
}
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/appc-daemon/blob/master/packages/appcd-detect/LICENSE
[2]: https://github.com/appcelerator/appc-daemon/issues
[3]: https://jira.appcelerator.org/projects/DAEMON/issues
