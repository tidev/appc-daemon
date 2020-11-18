> [Home](../../README.md) ➤ [Development](../README.md) ➤ Appc Daemon Development

> :warning: Under construction.

# Appc Daemon Development

 * [Architecture](Architecture/README.md)
   - [Configuration](Architecture/Configuration.md)
   - [Dispatcher](Architecture/Dispatcher.md)
   - [Filesystem Watcher](Architecture/Filesystem%20Watcher.md)
   - [Logging](Architecture/Logging.md)
   - [Plugin System](Architecture/Plugin%20System.md)
   - [Status Monitor](Architecture/Status%20Monitor.md)
   - [Subprocess Manager](Architecture/Subprocess%20Manager.md)
   - [Telemetry](Architecture/Telemetry.md)
   - [Web Server](Architecture/Web%20Server.md)
 * [Testing](Testing.md)
 * [Distribution](Distribution.md)

## Workflow

Under construction.

## Running in Debug Mode

Starts the Appc Daemon, but does not background the Appc Daemon Core process or detach stdio.

```bash
appcd start --debug
```

Press <kbd>CTRL-C</kbd> to stop the Appc Daemon.

### Developing the Appc Daemon

To rebuild the entire Appc Daemon project and all of its packages, simply run:

```bash
gulp build
```

When developing on the Appc Daemon, it is much faster to use the watch task:

```bash
gulp watch
```

The watch task will monitor all of the Appc Daemon packages for changes. When a file is modified, it
will rebuild that package and all parent packages, then restart the Appc Daemon.

> :bulb: Note that the `gulp watch` task is not bulletproof. If you save a .js file that contains
> malformed JavaScript code, it's likely going to cause `gulp` to exit, but the last spawned Appc
> Daemon process will remain running. You may need to run `appcd stop` or `killall appcd`.

When running the Appc Daemon with the `gulp watch` task telemetry will be sent using the
`development` deployType.

### Debugging the Appc Daemon

To debug the Appc Daemon, you can:

* Debug the Appc Daemon in debug mode
* Debug the appcd-core directly

> :bulb: Before debugging, make sure you have the NIM (Node Inspector Manager) Chrome Extension
> installed:
>
> https://chrome.google.com/webstore/detail/nim-node-inspector-manage/gnhhdgbaldcilmgcpfddgdbkhjohddkj
>
> The NIM extension will detect when the Appc Daemon has been started in debug mode and
> automatically connect to it.

#### Debug the Appc Daemon in Debug Mode

```bash
appcd start --debug
```

For continuous development, run the `watch` task:

```bash
gulp watch
```

#### Debugging appcd with the Node debugger

```bash
gulp debug
```

#### Debugging the appcd-core with the Node debugger

If for some reason the appcd CLI is getting in the way of debugging, you can debug the
`appcd-core` directly:

```bash
gulp build
node --inspect package/appcd-core/dist/main.js
```

### Checking dependency updates

Periodically, run the check task to make sure all of the npm dependencies are up-to-date and that
there is no security issues. If there are any issues, follow the recommended actions.

```bash
gulp check
```

To upgrade dependencies within the defined dependency semver ranges, run `gulp upgrade`.

To upgrade dependency semver ranges, run `gulp upgrade -u`.

### Updating the Source Code

After doing a `git pull` or switching a branch, you must run:

```bash
yarn
```

This will ensure all dependencies for each package match those in the `package.json` files.

