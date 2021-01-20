# Appc Daemon 2.7.0

## Jun 25, 2019

This is a minor release with new features, bug fixes, and dependency updates.

### Installation

```
npm i -g appcd@2.7.0
```

### appcd

 * **v2.7.0** - 6/25/2019

   * chore: Updated to `appcd-core@2.8.0` which updated to `appcd-default-plugins@3.0.0`.

### appcd-config-service

 * **v2.0.0** - 6/24/2019

   * BREAKING CHANGE: Updated to `appcd-dispatche@2.0.0` and `appcd-response@2.0.0`.

### appcd-core

 * **v2.8.0** - 6/25/2019

   * chore: Updated to `appcd-default-plugins@3.0.0`.

### appcd-default-plugins

 * **v3.0.0** - 6/25/2019

   * BREAKING CHANGE: `appcd-default-plugins` no longer includes a "main" JavaScript file so it
     cannot be `require()`'d.
   * BREAKING CHANGE: Plugins are installed into `"~/.appcelerator/appcd/plugins"` instead of the
     `"appcd-default-plugins/plugins"` directory to avoid permission issues when npm installing
     `appcd` globally using `sudo` due to npm dropping root before running the post install script.
  
     UPDATE: Turns out that this won't work because unless there's an explicit `user` set in the
     npm config, it defaults to the user `nobody` which does not have write permissions to the
     user's home directory.