# ![Appc Daemon logo](images/appc-daemon.png) Daemon Project

## Architecture

The Appc Daemon is comprised of two main components: the CLI and the core.

### appcd CLI

The appcd CLI is an npm package and is responsible for making sure the Appc Daemon core's
required Node.js version is installed before invoking the core.

The appcd CLI is responsible for:

 * Managing the Appc Daemon configuration
 * Ensure the required version of Node.js is installed (and downloads it if needed)
 * Spawning the Appc Daemon Core as a detached background process
 * Querying the status of the Appc Deamon
 * Executing requests directly into the Appc Daemon

#### Node.js Versions

The Appc Daemon requires Node.js 10.13.0 or newer installed on your machine.

The appcd CLI will spawn the appcd core using with the exact Node.js version that the core has
specified in its `package.json`.

The appcd CLI will check to see if `~/.appcelerator/appcd/node/<version>/<platform>/<arch>/node`
exists. If it doesn't, the appcd CLI will download it from Node.js' website, then extract and
install it.

No compiler or root privileges are required.

Note that npm or Yarn can be used to install the Appc Daemon, however Yarn is required for
development.

As the Appc Daemon is upgraded, the appcd core may depend on a new version of Node.js. In order to
avoid having unused Node.js versions in the `~/.appcelerator/appcd/node` directory, the daemon will
delete Node.js versions that haven't been used for some period of time. If an old version is needed,
it will re-download and install it.

#### Daemon Mode

When the appcd CLI spawns the Appc Daemon Core, it will by default detach the Core process without
stdio, then exit leaving the Core running in the background. If the Appc Daemon is started with the
`--debug` flag, it will _not_ detach the Core process and stdio will be inherited.

When the Core is spawned, V8 settings will be adjusted per the Appc Daemon
[config V8 settings](Configuration#V8). For example, if `core.v8.memory` is set to `auto`, which is
the default, then it will dynamically set the Node.js V8 `--max_old_space_size` option based on how
much memory your computer has and what architecture your operating system is (64-bit or 32-bit).

### Core

The Core is responsible for creating the web and WebSocket server, managing plugins, dispatching
incoming requests to services, logging, telemetry, and status monitoring.

It resides in the [appcd-core](../../packages/appcd-core) package.

#### Spawning the Core

The Core can only be invoked directly and cannot be loaded via `require('appcd-core')`.

The Core is and should almost always be spawned by the appcd CLI. However, it is possible to spawn
the Core directly bypassing the appcd CLI. This is useful for debugging, but is very cumbersome. For
more information about debugging the Core directly, please refer to the
[Debugging the Appc Daemon](Getting-Started.md#debugging-the-appc-daemon) in the Getting Started
documenation.

The Core is technically not a CLI app, however it does look for `--config <json>` and
`--config-file <path>` in the command line arguments.

The Core MUST be spawned using the exact Node.js version specified in the `appcd-core`
[`package.json`](../../packages/appcd-core/package.json) under the `appcd` section.

The Core has no concern for if it is running in daemon mode or debug mode. The Core process is
either running or it isn't.

#### Lifecycle

The Appc Daemon Server consists of a "start" and "stop" lifecycle.

During startup, it will:

* Read the configuration file
* Enable logging
* Ensure the process is not running as `root`
* Ensure the Appc Daemon is not already running
* Write a "pid" file
* Rename the process to "appcd"
* Listen for SIGINT and SIGTERM
* Initialize and register all services
* Wire up the appcd dispatcher
* Start the web server
* Start the telemetry system

During shutdown, it will:

* Stop and unregister all services
* Remove the "pid" file
* Stop any pending timers
* Exit the process

#### pid File

Only one instance of the Appc Daemon can be running at a time. The Core does this by using a "pid"
file which contains the process id for an existing Appc Daemon instance.

If the pid file does not exist, then it assumes there are no running instances of the Appc Daemon.
However, if for some reason the pid file was removed while the Appc Daemon is running, then any new
instance of the Appc Daemon will continue to start until it tries to bind to the already in use
port.

If the pid file does exist, the Core will attempt to send a signal to the process id and check if
the pid file was stale. If an existing Appc Daemon process is not running, then a new pid file is
written with the current process's id.

#### Components

The Appc Daemon Core is comprised of several components. Refer to each individual component for more
information:

* [Configuration System](Components/Configuration-System.md)
* [Dispatcher](Components/Dispatcher.md)
* [File System Watcher](Components/File-System-Watcher.md)
* [Hook System](Components/Hook-System.md)
* [Logging](Components/Logging.md)
* [Plugin System](Components/Plugin-System.md)
* [Status Monitor](Components/Status-Monitor.md)
* [Subprocess Manager](Components/Subprocess-Manager.md)
* [Telemetry](Components/Telemetry.md)
* [Web Server](Components/Web-Server.md)
