# appcd-default-plugins

A psuedo package that installs the latest major versions of all default _appcd_ plugins into the
user's appcd home directrory (e.g. `"~/.appcelerator/appcd/plugins"`).

Visit https://github.com/appcelerator/appc-daemon for more information.

## Overview

After installing `appcd-default-plugins`, a post-install script will run and download every major
plugin release and puts it in the `"~/.appcelerator/appcd/plugins"` directory.

If any of the plugins match locally linked packages using _yarn_, then it will use those instead of
installing from _npm_.

A list of packages to be installed is used to create a monorepo in the `plugins` directory, then
it runs `lerna` to initialize it.

The post-install script will detect if _yarn_ is installed. If found, it will initialize the
monorepo using _yarn_'s workspaces, otherwise it fallsback to _npm_ with hoisting.

If at all possible, you should install _yarn_ before installing `appcd-default-plugins`. yarn is
about 3 times faster and uses about 75% less disk space.

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/appc-daemon/blob/master/packages/appcd-default-plugins/LICENSE
