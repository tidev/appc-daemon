# Appc Daemon

![Appc Daemon logo](appc-daemon.png)

## Overview

The Appc Daemon is a new architecture for powering client-side tooling for
Appcelerator products such as Titanium.

This is a monorepo that contains all of the Appc Daemon related source code. It
is broken up into separate subdirectories:

### Bootstrap

The CLI and main entry point for the Appc Daemon. It is responsible for
detecting all appcd cores and loading a core.

### Core

This is the Appc Daemon server. It provides all the facilities for plugin
management, logging, analytics, and more.

### Packages

This contains various micro dependencies of the daemon and its plugins.

### Plugins

There are several built-in plugins that ship with the Appc Daemon:

 * Appc CLI
 * Appc Platform
 * System Info

## Build Instructions

In order to build the daemon, you must first install a few dependencies.

	sudo npm install -g optional-dev-dependency
	brew update && brew install yarn

	yarn
	gulp install
	sudo npm link

## Development Workflow

Simply run `gulp watch` or `gulp build`.

Periodically, run `gulp check` to make sure everything is up-to-date.

Dependencies are maintained in the `dependency-map.json` file. If this file is
changed, then run `gulp link` to wire things up.
