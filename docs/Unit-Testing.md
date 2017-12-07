# ![Appc Daemon logo](images/appc-daemon.png) Daemon Project

## Unit Testing

The Appc Daemon uses the [gulp](https://npmjs.org/package/gulp) task runner for running unit tests
and code coverage.

### Top-Level Unit Tests and Code Coverage

The top-level Appc Daemon gulp file has a `coverage` task that will run the unit tests and code
coverage for all packages and plugins. It will merge all the individual coverage reports into a
single report and put it in the `/path/to/appc-daemon/coverage` directory.

```bash
gulp test
```

```bash
gulp coverage
```

### Package-Level Unit Tests and Code Coverage

Each package and plugin depends on the `appcd-gulp` package. This package provides a `test` and
`coverage` tasks.

#### Unit Tests

The `test` task will:

* Lint the source and the tests.
* Builds the source
* All tests are transpiled on-the-fly using
  [`babel-register`](https://www.npmjs.com/package/babel-register)
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

##### Debugging Tests

To enable debugging, pass in the `--inspect` flag:

```bash
SNOOPLOGG=* gulp test --inspect
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

* Lints the source and tests
* Runs [nyc](https://github.com/istanbuljs/nyc)
	* `nyc` wraps subprocess calls so that it can track them
	* All source and tests are transpiled and instrumented on-the-fly using
      [`babel-register`](https://www.npmjs.com/package/babel-register)
	* Runs [mocha](https://mochajs.org/)
	* Writes coverage reports to `<package>/coverage`

```bash
gulp coverage
```

### Babel Transpilation

It's important to note that the `test` task will test the actual distribution source in the `dist`
directory. The `coverage` task does not build the source, but rather transpiles and instruments it
on-the-fly.

ECMAScript features are available to unit tests. The unit tests are transpiled on-the-fly using
[`babel-register`](https://www.npmjs.com/package/babel-register).
[`babel-register`](https://www.npmjs.com/package/babel-register) wraps `require()` and if a module
being required is a test file, then it will be transpiled and cached in Node's module cache. This
means that transpiled tests are _not_ written to disk and they can continue to reference fixtures
and resouces in the `test` directory.
