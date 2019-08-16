# appcd-default-plugins

A psuedo package that attempts to install the latest major versions of all default _appcd_ plugins
into the user's appcd home directrory (e.g. `"~/.appcelerator/appcd/plugins"`) postinstall and
optionally at runtime.

Visit https://github.com/appcelerator/appc-daemon for more information.

Report issues to [GitHub issues][2]. Official issue tracker in [JIRA][3].

## Usage

```js
import { installDefaultPlugins } from 'appcd-default-plugins';

await installDefaultPlugins('/path/to/plugins/dir');
```

## Details

`appcd-default-plugins` deploys two strategies for installing the default appcd plugins:
post-install and at runtime.

Post-install is the ideal time to install the default plugins, however if the user installs as root
(e.g. sudo), then `npm` will drop permissions and the post-install script will be unable to write
to the plugins directory. In this case, the permission error is suppressed allowing the install to
complete.

`appcd-default-plugins` leverages _lerna_ and _yarn_ to create a local workspace for the purpose of
optimizing a hoisted `node_modules` directory.

Since downloading and installing a plugin and its dependencies is an expensive operation, it will
only install a plugin from _npm_ if there are no installed plugins that satisfy the plugin's specs.
Likewise, it will only invoke _lerna_ if a plugin was installed or a plugin was removed/invalidated.

The `installDefaultPlugins()` function performs a number of steps to attempt to install the default
plugins:

1. Determine if the plugins directory is writable.
2. Locate the _yarn_ and _lerna_ scripts.
3. Detect existing list of workspaces that were created during `postinstall` or previous _appcd_
   start.
4. Detect existing installed plugins.
    - Invalid plugins are quarantine in a `/path/to/plugins/invalid` directory.
5. Detect an global yarn links.
    - Symlink any new yarn links.
6. Loop over the list of default _appcd_ plugins and figure out what needs to be installed.
7. Install the missing _appcd_ plugins.
8. Assuming one or more plugins where installed or the list of workspaces has changed, then:
    - Rewrite every plugin's package name in their respective `package.json` files to make
      lerna/yarn happy.
    - Write the main `package.json` and `lerna.json` files.
    - Execute _lerna bootstrap_ which in turn executes _yarn_.
    - Revert the plugin package names.

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/appc-daemon/blob/master/packages/appcd-default-plugins/LICENSE
[2]: https://github.com/appcelerator/appc-daemon/issues
[3]: https://jira.appcelerator.org/projects/DAEMON/issues
