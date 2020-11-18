> [Home](../README.md) ➤ [Development](README.md) ➤ Testing

# Testing

The Appc Daemon has a package called `appcd-gulp` that provides the framework for running tests.
It uses [mocha](https://www.npmjs.com/package/mocha) to run the tests and
[nyc](https://www.npmjs.com/package/nyc) to instrument the code for coverage reporting.

## Integration Tests

Integration tests are top-level tests that test all of the Appc Daemon's systems together. These
tests include plugins.

| Commmand                     | Lints | Builds | Integration Tests | Unit Tests | Coverage Reporting |
| ---------------------------- | :---: | :----: | :---------------: | :--------: | :----------------: |
| `gulp integration-test`      |  Yes  |   Yes  |        Yes        |     No     |         No         |
| `gulp integration-test-only` |  No   |   No   |        Yes        |     No     |         No         |
| `gulp integration-coverage`  |  No   |   No   |        Yes        |     No     |         Yes        |
| `gulp coverage`              |  Yes  |   Yes  |        Yes        |     Yes    |         Yes        |
| `gulp coverage-only`         |  No   |   No   |        Yes        |     Yes    |         Yes        |

As a developer, if you are working on an integration test, you probably only need to build the
packages one time with a `gulp build` (or `gulp coverage-ci`), then you can run `gulp coverage` as
you iterate.

The Jenkins continuous integration job runs the `gulp coverage-ci` task.

## Unit Tests

Unit tests are package-level tests that test specific API's and low level features.

| Commmand        | Lints | Builds | Coverage Reporting |
| --------------- | :---: | :----: | :----------------: |
| `gulp test`     |  Yes  |   Yes  |         No         |
| `gulp coverage` |  Yes  |   Yes  |         Yes        |

### Debug Log Output

To display debug logging while running unit tests, run:

	SNOOPLOGG=* gulp test

### Debugging Tests

To enable debugging, pass in the `--inspect` flag:

	SNOOPLOGG=* gulp test --inspect

### Running a Suite

To run tests for a specific suite (`test/test-<suite>.js`), run:

	gulp test --suite foo

### Running a Specific Test Case

To run a specific test, pass in a `--grep <pattern>` that matches the test name.

	gulp test --grep foo

## Code Coverage

The code coverage report is written into the package's `coverage` directory. It write the report
as HTML, JSON, Cobertura, and lcov.

For integration tests, the code coverage reports for all tests, including unit tests, are merged
together into a single report in the `/path/to/appc-daemon/coverage` directory.

## Babel Code Transpilation

It's important to note that the `test` task will test the actual distribution source in the `dist`
directory. The `coverage` task does not build the source, but rather transpiles and instruments it
directly from the `src` directory on-the-fly.

The Mocha unit tests files themselves are transpiled on-the-fly using
[`babel-register`](https://www.npmjs.com/package/babel-register) and monkey patching Node.js's
module system. The monkey patch checks if the module being `require()`'d is a test file, then
transpiles and caches it into Node's module cache. This means that transpiled tests are _not_
written to disk and they can continue to reference fixtures and resouces in the `test` directory.
