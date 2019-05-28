> DEPRECATION NOTICE!
>
> `appcd-winreg` has been deprecated in favor of the amazing [`winreglib`][2] package.

# appcd-winreg

Simplified API for querying the Windows Registry.

Visit https://github.com/appcelerator/appc-daemon for more information.

## Installation

	npm i appcd-winreg

## Usage

```js
import * as winreg from 'appcd-winreg';

const value = await winreg.get('HKLM', 'SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion', 'ProductName');
console.log(value);

const keys = await winreg.keys('HKLM', 'SOFTWARE\\Microsoft\\Windows NT');
console.log(keys);
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/appc-daemon/blob/master/packages/appcd-winreg/LICENSE
[2]: https://www.npmjs.com/package/winreglib
