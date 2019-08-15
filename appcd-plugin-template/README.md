# @appcd/plugin-template

### Prerequisites

You must have the [Appc Daemon](https://www.npmjs.com/package/appcd) installed. Currently, it comes
bundled with the Appc Unified CLI.

You must have [Node.js](https://nodejs.org/) 8 or newer.

You must have [yarn](https://yarnpkg.com/) or [npm](https://www.npmjs.com/).

You must have [`gulp`](https://www.npmjs.com/package/gulp) installed. To install run:

```
npm i -g gulp
```

### 1. Choose a project name

It is recommended that you prefix the name your plugin with `appcd-plugin-`.

### 2. Clone this repo

```
git clone https://github.com/appcelerator/appcd-plugin-template.git PROJECT_NAME
cd PROJECT_NAME
```

### 3. Update the `package.json`

Set the `PROJECT_NAME` and `PLUGIN_NAME` in the `package.json`.

The `PROJECT_NAME` is the package name and what the name that the plugin will be published as on
npm.

The `PLUGIN_NAME` is the name to use when routing requests to the plugin. This should NOT be
prefixed.

For example, if you `PROJECT_NAME` is `appcd-plugin-foo`, then the `PLUGIN_NAME` should be `FOO`.

### 4. Install npm dependencies

Run `yarn` or `npm i`.

### 5. Link the plugin

```
mkdir -p ~/.appcelerator/appcd/plugins
ln -s `pwd` ~/.appcelerator/appcd/plugins/
```

## Developer Workflow

The Appc Daemon will watch your plugin for updates and automatically unload it if the files are
updated.

The ideal workflow is to have two terminal sessions. One terminal is running `appcd start --debug`
or if the daemon is already running, execute `appcd logcat`. In the second terminal, change your
current wording directory to your plugin directory, then run `gulp watch`.

As you change plugin source files, `gulp watch` will will build your plugin. The Appc Daemon will
detect these changes and unload your plugin. Simply execute a service in your plugin to load it.

```
appcd exec /PLUGIN_NAME/latest/SERVICE
```

## Documentation

Please refer to the Appc Daemon's [Plugin System][plugin_system] docs for information about plugin
types, lifecycle, `package.json` settings, `appcd-*` dependencies, and debugging.

[plugin_system]: https://github.com/appcelerator/appc-daemon/blob/master/docs/Components/Plugin-System.md
