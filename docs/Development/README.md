> [Home](../README.md) ➤ Development

# Development

 * [Prerequisites](README.md#prerequisites)
 * [Initialize Local Repository](README.md#initialize-local-repository)
 * [Appc Daemon Development](appcd/README.md)
   - [Architecture](appcd/Architecture/README.md)
      - [Configuration](appcd/Architecture/Configuration.md)
      - [Dispatcher](appcd/Architecture/Dispatcher.md)
      - [Filesystem Watcher](appcd/Architecture/Filesystem%20Watcher.md)
      - [Logging](appcd/Architecture/Logging.md)
      - [Plugin System](appcd/Architecture/Plugin%20System.md)
      - [Status Monitor](appcd/Architecture/Status%20Monitor.md)
      - [Subprocess Manager](appcd/Architecture/Subprocess%20Manager.md)
      - [Telemetry](appcd/Architecture/Telemetry.md)
      - [Web Server](appcd/Architecture/Web%20Server.md)
   - [Testing](appcd/Testing.md)
   - [Distribution](appcd/Distribution.md)
 * [Developing Plugins](Plugins.md)

## Prerequisites

The Appc Daemon requires the following:

| Name                                         | Version    | Description        |
| -------------------------------------------- | ---------- | ------------------ |
| [Node.js](https://nodejs.org)                | >=10.13.0* | JavaScript runtime |
| [gulp](https://www.npmjs.com/package/gulp)   | 4.x        | Task runner        |
| [lerna](https://www.npmjs.com/package/lerna) | 3.x        | Monorepo utilities |
| [Yarn](https://classic.yarnpkg.com/lang/en/) | 1.x        | Package manager    |

\* The latest LTS release is recommended

The daemon source, plugins, and dependencies requires around 2GB of disk space.

### gulp & lerna

You can install all these tools by running:

```
npm i -g gulp@4.x lerna@3.x
```

### yarn

> :warning: Attention! :warning:
>
> Appc Daemon required Yarn 1.x. Yarn >=2 is NOT supported.

To install Yarn, refer to Yarn's documentation https://classic.yarnpkg.com/en/docs/install.

## Initialize Local Repository

> :bulb: Developers should fork the Appc Daemon repo: https://github.com/appcelerator/appc-daemon.

```bash
git clone git@github.com:appcelerator/appc-daemon.git
cd appc-daemon
yarn
gulp build
```

### `appcd` Global Executable

Since the Appc Daemon uses Yarn, you cannot use `npm link` the `appcd` binary and Yarn doesn't have
an equivalent. You must manually link the binary.

#### macOS & Linux

```bash
[sudo] ln -s `pwd`/packages/appcd/bin/appcd /usr/local/bin/appcd
```

#### Windows

Create a file named `C:\Users\<USERNAME>\AppData\Roaming\npm\appcd.cmd` and paste the following:

```
@echo off
@SETLOCAL
@SET PATHEXT=%PATHEXT:;.JS;=;%
node  "%~d0\Users\<USERNAME>\<SOME_PATH>\appc-daemon\packages\appcd\bin\appcd" %*
```

## Next Steps

 * [Appc Daemon Development](appcd.md)
 * [Developing Plugins](Plugins.md)
