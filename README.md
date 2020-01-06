# ![Appc Daemon logo](docs/images/appc-daemon.png) Appc Daemon

The Appc Daemon is a server that runs on a developer's computer and hosts services which power the
tooling for Axway products such as Axway Titanium SDK.

This monorepo contains several packages which collectively define the Appc Daemon.

Refer to the [docs](docs/) for getting started and technical information.

Report issues to [GitHub issues][2]. Official issue tracker in [JIRA][3].

## Plugins

Plugins are installed directly from `npm` or by `appcd-default-plugins` at install or runtime.

### Plugin Development Workflow

The plugins are located in separate repos and referenced as git submodules. To work on a plugin,
begin by forking the specific plugin repo and initialize the submodules referenced in this repo.
Run `gulp sync` to generate a `.appcdrc`, then edit this file and update the plugin remote URLs,
then rerun the command.

```sh
git pull
gulp sync
yarn
gulp build
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/appc-daemon/blob/master/LICENSE
[2]: https://github.com/appcelerator/appc-daemon/issues
[3]: https://jira.appcelerator.org/projects/DAEMON/issues
