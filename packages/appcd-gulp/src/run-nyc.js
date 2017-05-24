/**
 * `nyc` uses `spawn-wrap@1.2.4` which has a bug with running a different Node.js executable than
 * the current one. This is fixed as of `spawn-wrap@1.3.5`.
 *
 * The following code replaces on-the-fly the bad `spawn-wrap` for the most recent version.
 *
 * Should `nyc` update the `spawn-wrap` version, then we can remove this file and its invocation
 * in `standard.js` inside the `runTests()` function.
 *
 * https://github.com/istanbuljs/nyc/issues/577
 */

const fs = require('fs');
const Module = require('module');
const originalLoader = Module._extensions['.js'];
const spawnSwapRE = /\/spawn-wrap\/index\.js$/;

Module._extensions['.js'] = function (module, filename) {
	if (spawnSwapRE.test(filename)) {
		filename = require.resolve('spawn-wrap');
		module._compile(fs.readFileSync(filename, 'UTF-8'), filename);
	} else {
		originalLoader(module, filename);
	}
};

// remove this file from argv
process.argv.splice(1, 1);

// run nyc
require(process.argv[1]);
