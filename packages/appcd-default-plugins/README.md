# appcd-default-plugins

A psuedo package that installs the latest major versions of all default _appcd_ plugins into the
user's appcd home directrory (e.g. `"~/.appcelerator/appcd/plugins"`).

Visit https://github.com/appcelerator/appc-daemon for more information.

## Usage

```js
import installDefaultPlugins from 'appcd-default-plugins';

await installDefaultPlugins('/path/to/plugins/dir');
```

`installDefaultPlugins()` will download all default plugins if not already installed. If any of the
plugins match locally linked packages using _yarn_, then it will use those instead of installing
from _npm_.

The default plugins are installed into a `packages` directory inside the specified plugins
directory, then it initializes the plugins directory as a monorepo and runs `lerna bootstrap` using
`yarn`.

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/appc-daemon/blob/master/packages/appcd-default-plugins/LICENSE
