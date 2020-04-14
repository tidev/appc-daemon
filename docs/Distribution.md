# ![Appc Daemon logo](images/appc-daemon.png) Daemon Project

## Distribution

The Appc Daemon is distributed via npm (https://www.npmjs.com/package/appcd).

### License

The Appc Daemon and all of its packages and plugins are to be distributed under the Apache 2 open
source license.

### Release Process

The Appc Daemon uses [Lerna](https://lernajs.io/) to orchestrate installing package dependencies and
publishing the packages to npm.

The Appc Daemon uses Lerna in "independent" mode in which package versions are not in sync with each
other. Some packages change or have breaking changes more often than others.

### Publishing Steps

1. Run `gulp check` to ensure there are no security issues
2. Run `gulp coverage` to ensure all tests pass
3. Run `lerna updated` to see what has changed since the last publish
   - This gets your last git tag and then will run `git diff your-last-tag`
4. Run `lerna publish --git-remote <YOUR_APPCELERATOR_REPO_REMOTE_NAME>`
   - Bump the version that will be applied to all packages
   - Be sure to use a exact version and not a caret version
