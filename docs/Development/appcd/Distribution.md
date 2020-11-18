> [Home](../README.md) ➤ [Development](README.md) ➤ Distribution

# Distribution

The Appc Daemon is distributed via npm (https://www.npmjs.com/package/appcd).

## License

The Appc Daemon and all of its packages and plugins are distributed under the
[Apache 2](../../LICENSE) open source license.

## Release Process

The Appc Daemon uses [Lerna](https://lernajs.io/) to orchestrate installing package dependencies and
publishing the packages to npm.

The Appc Daemon uses Lerna in "independent" mode in which package versions are not in sync with each
other. Some packages change or have breaking changes more often than others.

## Publishing Steps

1. Run `gulp coverage` to ensure all tests pass
2. Update the `CHANGELOG.md` for each package with the appropriate version and date
3. Run `lerna updated` to see what has changed since the last publish
   - This gets your last git tag and then will run `git diff your-last-tag`
4. Run `lerna publish --git-remote <YOUR_APPCELERATOR_REPO_REMOTE_NAME>`
   - Bump the version that will be applied to all packages
   - Be sure to use a exact version and not a caret version

## Release Notes

To generate the release notes, run:

    gulp release-notes

The release notes are generated from the changelogs for the published packages. You need to publish
first because each of the packages are downloaded and aggregated.

Note that the `release-notes` task will generate release notes for all Appc Daemon releases.
