# appcd-default-plugins

A psuedo package that installs the latest major versions of all default _appcd_ plugins.

Visit https://github.com/appcelerator/appc-daemon for more information.

## Overview

After installing `appcd-default-plugins`, a post-install script will run and download every major
plugin release and puts it in the `"/path/to/appcd-default-plugins/plugins"` directory.

If any of the plugins match locally linked packages using _yarn_, then it will use those instead of
installing from _npm_.

A list of packages to be installed is used to create a monorepo in the `plugins` directory, then
it runs `lerna` to initialize it.

The post-install script will detect if _yarn_ is installed. If found, it will initialize the
monorepo using _yarn_'s workspaces, otherwise it fallsback to _npm_ with hoisting.

If at all possible, you should install _yarn_ before installing `appcd-default-plugins`. yarn is
about 12 faster and uses over 80% less disk space.

> Note that part of the problem with _npm_ is when it detects a `"prepare"` script in the plugin's
> `package.json` (which most plugins do) and the plugin's dependencies are being installed via a
> local `npm install` with no arguments (which _lerna_ does), then _npm_ will download the dev
> dependencies (despite specifying production only) and run the `"prepare"` statement.
>
> To make things worse, if the plugin uses _gulp_ (which most do), _gulp_ will detect the current
> working directory is not the top-level directory (despite attempts to force the cwd), and build
> every package in the _appcd_ monorepo.

## Installation

	npm i appcd-default-plugins

## Usage

```js
import defaultPluginPaths from 'appcd-default-plugins';

console.log(defaultPluginPaths);
```

```json
[ "/path/to/appcd-default-plugins/plugins/packages" ]
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/appc-daemon/blob/master/packages/appcd-default-plugins/LICENSE
