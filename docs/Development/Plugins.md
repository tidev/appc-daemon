> [Home](../README.md) ➤ [Development](README.md) ➤ Plugin Development

# Plugin Development

Appc Daemon Plugins are npm packages and are loaded from either the appcd home plugins directory or
the global modules path.

It is recommended that the plugin package name start with `"appcd-plugin-"` and that each plugin
have its own git repository

## Creating a Plugin

The easiest way to create a plugin is to use the Appc Daemon Plugin Manager CLI.

```bash
appcd pm new appcd-plugin-foo
```

## Building a Plugin

```bash
yarn run build
```

## Link the Plugin

```bash
yarn link
appcd pm link
```

## Testing the Plugin

```bash
appcd start
appcd exec /foo/latest
```

## Development Workflow

Now that your new plugin is created, linked, and working, you can run the watch task to rebuild
your plugin as you develop it.

```bash
yarn run watch
```

When the plugin is recompiled, the Appc Daemon will detect the plugin changes and stop the old
plugin. The new plugin code is automatically loaded the next time you execute a request to it.

## Debug Log

To view the debug log output from your plugin, run:

```bash
appcd logcat "*foo*"
```

> :bulb: Tip: Some terminal shells will treat `"*"` as a filename matching wildcard instead of a
> literal argument, so it is recommended to wrap the filter with quotes.
