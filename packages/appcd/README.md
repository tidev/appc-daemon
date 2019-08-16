# appcd

The Appc Daemon (appcd) is a background server that runs on a developer's computer and hosts
services. It provides essential components such as configuration, plugins, monitoring, filesystem
watching, and much more.

Visit https://github.com/appcelerator/appc-daemon for more information.

Report issues to [GitHub issues][2]. Official issue tracker in [JIRA][3].

## Installation

	npm i -g appcd

## Quick Start

Start the server:

	appcd start

Start the server in debug mode:

	appcd start --debug

Stop the server:

	appcd stop

Query the status of the server:

	appcd status

View server log output:

	appcd logcat

Invoke a service:

	appcd exec /appcd/status

	appcd exec /jdk/latest/info

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/appc-daemon/blob/master/packages/appcd/LICENSE
[2]: https://github.com/appcelerator/appc-daemon/issues
[3]: https://jira.appcelerator.org/projects/DAEMON/issues
