# appcd-util

Common utility functions.

Visit https://github.com/appcelerator/appc-daemon for more information.

## Installation

	npm i appcd-util

## Usage

```js
import { arch } from 'appcd-util';

console.log(arch()); // 'x86' or 'x64'
```

```js
import { arrayify } from 'appcd-util';

console.log(arrayify('foo')); // [ 'foo' ]

console.log(arrayify([ 'a', '', null, 'b' ], true)); // [ 'a', 'b' ]
```

```js
import { assertNodeEngineVersion } from 'appcd-util';

// throw an exception if current node version doesn't satisfy the `engines.node` version
assertNodeEngineVersion(require('package.json'));
```

```js
import { cache } from 'appcd-util';

const now = () => Date.now();

const first = await cache('my namespace', now);
const second = await cache('my namespace', now);
assert(first === second);

const third = await cache('my namespace', true, now);
assert(first !== third && second !== third);
```

```js
import { cacheSync } from 'appcd-util';

const now = () => Date.now();

const first = cacheSync('my namespace', now);
const second = cacheSync('my namespace', now);
assert(first === second);

const third = cacheSync('my namespace', true, now);
assert(first !== third && second !== third);
```

Debouncer that returns a promise and that can be cancelled.

```js
import { debounce } from 'appcd-util';

const fn = debounce(() => {
	console.log(new Date());
});

// schedule the callback to be called in 200ms
fn().then(() => {
	console.log('Function called');
});

// cancel the debounce
fn.cancel();
```

```js
import { formatNumber } from 'appcd-util';

console.log(formatNumber(12)); // 12
console.log(formatNumber(123)); // 123
console.log(formatNumber(1234)); // 1,234
console.log(formatNumber(12345)); // 12,345
console.log(formatNumber(123456)); // 123,456
console.log(formatNumber(1234567)); // 1,234,567
```

```js
import { get } from 'appcd-util';

const obj = {
	foo: 'bar'
};

console.log(get(obj, 'foo')); // 'bar'
console.log(get(obj, 'baz', 'pow')); // 'pow'
```

Get all open sockets, [net] servers, timers, child processes, filesystem watchers, and other
handles.

```js
import { getActiveHandles } from 'appcd-util';

console.log(getActiveHandles());
```

```js
import { inherits } from 'appcd-util';

class A {}
class B extends A {}
class C {}

console.log(inherits(B, A)); // true
console.log(inherits(B, C)); // false
```

```js
import { mergeDeep } from 'appcd-util';

const obj1 = {
	a: {
		b: 'c'
	}
};

const obj2 = {
	a: {
		d: 'e'
	}
};

console.log(mergeDeep(obj1, obj2)); // { a: { b: 'c', d: 'e' } }
```

```js
import { mutex } from 'appcd-util';

const fn = () => {
	return mutex('my mutex', () => {
		console.log('foo!');
	});
};

await Promise.all([ fn(), fn(), fn() ]);
```

```js
import { randomBytes } from 'appcd-util';

console.log(randomBytes(20));
```

```js
import { sha1 } from 'appcd-util';

console.log(sha1('foo'));
```

```js
import { sleep } from 'appcd-util';

await sleep(1000); // sleep for 1 second
```

Block multiple simultaneous callers until the first caller finishes, then all queued up 'tailgaters'
are resolved with the result.

```js
import { tailgate } from 'appcd-util';

const fn = () => {
	return tailgate('my tailgate', () {
		console.log('I will only be called once');
	});
};

await Promise.all([ fn(), fn(), fn() ]);
```

```js
import { unique } from 'appcd-util';

console.log(unique([ 'a', 'b', 'a', 'b' ])); // [ 'a', 'b' ]
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/appc-daemon/packages/appcd-util/LICENSE
