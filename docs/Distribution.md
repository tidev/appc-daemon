# ![Appc Daemon logo](images/appc-daemon.png) Daemon Project

## Distribution

The Appc Daemon is intended to be distributed via npm.

### License

The Appc Daemon and all of its packages and plugins are to be distributed under the Apache 2 open
source license.

### Release Process

The Appc Daemon uses [Lerna](https://lernajs.io/) to orchestrate installing package dependencies and
publishing the packages to npm.

The Appc Daemon uses Lerna in "fixed" mode in which every package has the same version number.

Note that Lerna will only bump a package's version number if it changed since the last publish. This
will prevent different releases with the same code. However this will harmlessly introduce gaps in
the version sequence.

### Publishing Steps

1. Run `gulp check` to ensure there are no security issues
2. Run `gulp coverage` to ensure all tests pass
3. Run `lerna updated` to see what has changed since the last publish
   - This gets your last git tag and then will run `git diff your-last-tag`
4. Run `lerna publish --git-remote <YOUR_APPCELERATOR_REPO_REMOTE_NAME>`
   - Bump the version that will be applied to all packages
   - Be sure to use a exact version and not a caret version

### Offline Releases

> Note: this feature is not complete.

An offline release is a `.zip` file that contains the Appc Daemon and all of its dependencies. Since
this archive includes Node.js and other native Node.js addons, you must download the correct version
for your operating system and architecture. The Appc Daemon supports the following platforms:

* macOS (64-bit)
* Linux (32-bit and 64-bit)
* Windows (32-bit and 64-bit)
