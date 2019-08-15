# ![Appc Daemon logo](docs/images/appc-daemon.png) Appc Daemon

The Appc Daemon is a server that runs on a developer's computer and hosts services which power the
tooling for Axway products such as Axway Titanium SDK.

This monorepo contains several packages which collectively define the Appc Daemon.

Refer to the [docs](docs/) for getting started and technical information.

Report issues in [JIRA](https://jira.appcelerator.org/projects/DAEMON/issues).

## Plugins

Plugins are installed directly from `npm` or by `appcd-default-plugins` at install or runtime.

### Plugin Development Workflow

The plugins are located in separate repos and referenced as git submodules. To work on a plugin,
begin by forking the specific plugin repo and initialize the submodules referenced in this repo.
Finally, edit the the user-defined submodule mappings in the git config file and update.

```sh
# add the submodule entries to the config file
git submodule init

# OPTIONAL: update the submodule entries to reference your fork of each
GITHUB_USER=<your_github_username>
GIT_REMOTE=<name_of_appc_remote>

mv .git/config .git/config.bak

sed -E "s/(git@github\.com:)appcelerator(\/appcd-plugin-)/\1${GITHUB_USER}\2/" .git/config.bak > .git/config

# fetch the submodules
git submodule update

# OPTIONAL: add remote for each submodule
git submodule foreach "git remote add $GIT_REMOTE `git remote get-url origin | sed -E s/$GITHUB_USER/appcelerator/`"

# install deps, link, and build
yarn
gulp link-plugins
gulp build
```

To get the latest changes:

```sh
git pull $GIT_REMOTE master # pull latest code
git submodule update # pull latest plugin code
yarn # install latest deps
gulp link-plugins # just in case there are new plugins
gulp build
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/appc-daemon/blob/master/LICENSE
