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
			key: 'HKLM\\Software\\Microsoft\\Microsoft SDKs\\Windows',
			type: 'rescan'
		}
	],
	watch: true
});
```

The watch parameters vary by `type`. There are two types of param objects:

 * `path` - Gets and watches keys containing paths
 * `rescan` - Triggers a rescan when specific keys are changed

#### Paths

This is the default `type`. It requires either a `key` or array of `keys`. If both a `key` and an
array of `keys` are defined, then an error is thrown.

Each `key` is an object that requires a `value` (or value `name`) for the specified key containing
the path. A `key` may specify the `hive` separate from the `key`, however the detect engine will
just combine them.

During the detect engine startup, the registry key watchers are initialized and each key is
queried and its value added to the list of search paths.

The following are the same:

```js
{
	hive: 'HKLM', // not preferred, prepend to `key`, supported for legacy reasons
	key: 'SOFTWARE\\Android Studio',
	name: 'SdkPath' // prefer "value" instead of "name", supported for legacy reasons
}
```

```js
{
	key: 'HKLM\\SOFTWARE\\Android Studio',
	value: 'SdkPath'
}
```

```js
{
	key: 'HKLM\\SOFTWARE\\Android Studio',
	type: 'path', // optional as "path" is the default
	value: 'SdkPath'
}
```

```js
{
	keys: [
		{
			key: 'HKLM\\SOFTWARE\\Android Studio',
			value: 'SdkPath'
		}
	]
}
```

Optionally, a `key` may contain a `callback` which is invoked after activity for the specified key.
When `keys` is specified, a top-level `callback` is called after processing the activity for a
specified key.

A callback may return a `Promise`. The resolved value must be either a falsey value to use the
initial `value`, a new `value`, or an object containing the `value` and an optional `isDefault`
flag.

The following is an example of how callbacks are invoked:

```js
{
	async callback(value, engine) {
		// "value" contains the registry key value
		return value;
	},
	key: 'HKLM\\SOFTWARE\\Android Studio',
	value: 'SdkPath'
}
```

Note that the following are all the same:

```js
callback(value, engine) {
	// return undefined to use initial `value`
}
```

```js
callback(value, engine) {
	return value;
}
```

```js
callback(value, engine) {
	return { value };
}
```

```js
callback(value, engine) {
	return { isDefault: false, value };
}
```

When specifying multiple `keys`, `callback` at the `key` level works the same as above. However,
`callback` at the top-level is invoked with an array of `values`.

```js
{
	async callback(values, engine) {
		return {
			paths: values,
			defaultPath: values[0]
		};
	},
	keys: [
		{
			async callback(value, engine) {
				// "value" contains the registry key value
				return value;
			},
			key: 'HKLM\\SOFTWARE\\Android Studio',
			value: 'SdkPath'
		}
	]
}
```

Note that the following top-level callbacks are all the same:


```js
callback(values, engine) {
	// return `undefined` to use initial values
}
```

```js
callback(values, engine) {
	return values;
}
```

```js
callback(values, engine) {
	return {
		paths: values
	};
}
```

```js
callback(values, engine) {
	return {
		paths: values,
		defaultPath: values[0]
	};
}
```

#### Rescan

Rescan type watchers simply watch the specified keys for changes, optionally run the change event
through filters, and trigger a rescan on change.

```js
{
	key: 'HKLM\\Software\\Microsoft\\Microsoft SDKs\\Windows',
	type: 'rescan' // "type" is required
}
```

```js
{
	filter: {
		values: /^VisualStudio.+/
	},
	key: 'HKLM\\Software\\RegisteredApplications',
	type: 'rescan'
}
```

```js
{
	filter: {
		subkeys: /^VisualStudio.+/
	},
	key: 'HKLM\\Software\\WOW6432Node\\Microsoft',
	type: 'rescan'
}
```

The `filter` property is an object with `values` and/or `subkeys` containing a string or regex.
If `filter` is not specified, is an empty object, or does not contain a non-empty string or regex,
then no filtering is performed.

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/appc-daemon/blob/master/packages/appcd-detect/LICENSE
