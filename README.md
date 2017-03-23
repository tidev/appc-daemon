# Appc Daemon

![Appc Daemon logo](appc-daemon.png)

## Overview

The Appc Daemon is a new architecture for powering client-side tooling for Appcelerator products
such as Titanium.

This monorepo contains several packages which collectively define the Appc Daemon.

### Bootstrap

The bootstrap defines the appcd CLI and the code necessary for spawning the appcd core. The
bootstrap requires Node.js 4 or newer. However, before the bootstrap spawns the core, it determines
the core's required Node.js version, downloads it if not installed, and then uses it to spawn the
core. This allows the core to be locked down to a specific version of Node.js and its ECMAScript
capabilities.

### Core

The core package contains the server which services all requests. It is responsible for loading the
config, logging, telemetry, detecting and managing appcd plugins, creating the web server and
WebSocket server, and dispatching incoming requests to services.

### Plugins

All service logic, such as the Appc CLI and Titanium, belongs in a plugin. Appcd plugins are either
loaded internally or externally. Internal plugins are loaded in the same process as the daemon core
and cannot be unloaded. External plugins run in a plugin host subprocess and can be unloaded or
reloaded, but have limited plugin hook capabilities.

## Build Instructions

In order to build the daemon, you must first install a few dependencies.

* gulp

  `sudo npm install -g gulp`

* Yarn - https://yarnpkg.com/en/docs/install

  `brew update && brew install yarn`


	$ cd appc-daemon
	$ yarn
	$ sudo npm link

## Development Workflow

Simply run `gulp watch` or `gulp build`.

Periodically, run `gulp check` to make sure everything is up-to-date. If there are any issues,
follow the recommended actions.

Appcd packages are "linked" using Yarn's link feature. The dependencies are specified in the
`appcdDependencies` section of each package or plugin's `package.json`. When the `appcdDependencies`
is changed, run `gulp link` to wire things up.

## Release Build

To create a distributable release of the Appc Daemon, you must run `gulp package`. The generated
`.zip` file will be saved to the `dist` directory. From there you can `npm publish /path/to/zip` to
publish the release. You must not publish the Appc Daemon locally.
