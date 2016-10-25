# Appc Daemon

![Appc Daemon logo](appc-daemon.png)

## Overview

The Appc Daemon is a new architecture for powering client-side tooling for
Appcelerator products such as Titanium.

This is a monorepo that contains all of the Appc Daemon related source code. It
is broken up into separate subdirectories:

### Bootstrap (aka appcd)

The CLI and main entry point for the Appc Daemon. It is responsible for
detecting all appcd cores and loading a core.

### Client

This is the Node.js client for connecting to a running Appc Daemon server.

### Core

This is the Appc Daemon server. It provides all the facilities for plugin
management, logging, analytics, and more.

### Plugins

There are several built-in plugins that ship with the Appc Daemon:

 * Appc CLI
 * Appc Platform
 * System Info

## Development

First start by installing the root level dependencies:

	yarn install
	sudo npm link

From here, you simply need to run:

	gulp watch

Or

	gulp build
