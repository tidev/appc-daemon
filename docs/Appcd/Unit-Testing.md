# ![Appc Daemon logo](../images/appc-daemon.png) Daemon Project

## Unit Testing

The Appc Daemon uses the [gulp](https://npmjs.org/package/gulp) task runner for running unit tests
and code coverage.

### Top-Level Unit Tests and Code Coverage

The top-level Appc Daemon gulp file has a `coverage` task that will run the unit tests and code
coverage for all packages and plugins. It will merge all the individual coverage reports into a
single report and put it in the `/path/to/appc-daemon/coverage` directory.

```bash
gulp coverage
```

### Package-Level Unit Tests and Code Coverage

Each package and plugin depends on the `appcd-gulp` package. This package provides a `test` and
`coverage` tasks.

#### Unit Tests

The `test` task will:

* Lint the source and the tests.
* Check the appcd dependencies to make sure they have been built and that they aren't covered
  builds.
    * It will rebuild the appcd dependency if needed.
* Runs [mocha](https://mochajs.org/)

```bash
cd packages/<name>
gulp test
```

##### Debug Log Output

To display debug logging while running unit tests, run:

```bash
SNOOPLOGG=* gulp test
```

##### Running a Suite

To run tests for a specific suite (`test/test-<suite>.js`), run:

```bash
gulp test --suite foo
```

#### Running a Specific Test Case

To run a specific test, pass in a `--grep <pattern>` that matches the test name.

```bash
gulp test --grep foo
```

#### Code Coverage

The `coverage` task will:

* Lints the tests
* Builds the source with coverage
    * Lints the source
	* Transpile the code using Babel
	* Instruments the code using [babel-plugin-istanbul](https://github.com/istanbuljs/babel-plugin-istanbul)
* Check the appcd dependencies to make sure they have been built and that they aren't covered
  builds.
    * It will rebuild the appcd dependency if needed.
* Runs [nyc](https://github.com/istanbuljs/nyc)
	* `nyc` wraps subprocess calls so that it can track them
	* Runs [mocha](https://mochajs.org/)
	* Writes coverage reports to `<package>/coverage`

```bash
gulp coverage
```

### Babel Transpilation

It's important to note that the unit tests are testing the package's transpiled code from the `dist`
directory. This is so you can test the exact same code that is shipping.

However, since appcd packages have dependencies on other appcd packages, it's possible for the
dependency's `dist` directory to contain instrumented transpiled code. That's why the `test` and
`coverage` tasks have to check all appcd dependencies to make sure they are built and they aren't
code coverage builds. If a dependency is left as a covered build, then it will skew the coverage
report. A simple check will rebuild the dependency before running the coverage tests.

ECMAScript features are available to unit tests. The unit tests are transpiled on-the-fly using
[babel-register](https://www.npmjs.com/package/babel-register). babel-register wraps `require()`
and if a module being required is a test file, then it will be transpiled and cached in Node's
module cache. This means that transpiled tests are _not_ written to disk and they can continue to
reference fixtures and resouces in the `test` directory.
