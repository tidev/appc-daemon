# ![Appc Daemon logo](../images/appc-daemon.png) Daemon Project

## Distribution

The Appc Daemon is intended to be distributed via NPM under the `appcd` package name.

### License

:warning: At this time, the Appc Daemon license has not been determined.

### Release Process

1. Run `gulp check` to ensure there are no security issues
2. Run `gulp coverage` to ensure all tests pass
3. Run `gulp package` to build a distribution tarball (`.tgz`)
4. Run `npm publish dist/appcd-<version>.tgz`

### Offline Releases

> Note: this feature is not complete.

An offline release is a `.zip` file that contains the Appc Daemon and all of its dependencies. Since
this archive includes Node.js and other native Node.js addons, you must download the correct version
for your operating system and architecture. The Appc Daemon supports the following platforms:

* macOS (64-bit)
* Linux (32-bit and 64-bit)
* Windows (32-bit and 64-bit)
