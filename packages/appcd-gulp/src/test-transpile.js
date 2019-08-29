const fs = require('fs-extra');
const Module = require('module');
const path = require('path');

const babelRE = /^(babel-|@babel\/)\w+/;
const minifyRE = /^minify|babili$/;
const conf = require('./babel.js')();
const originalResolveFilename = Module._resolveFilename;

// remove babili from tests and resolve all babel plugins/presets
Object.keys(conf).forEach(function (key) {
	if ((key === 'plugins' || key === 'presets') && Array.isArray(conf[key])) {
		for (var i = 0; i < conf[key].length; i++) {
			const isArr = Array.isArray(conf[key][i]);
	 		let name = isArr ? conf[key][i][0] : conf[key][i];
			if (minifyRE.test(name)) {
				conf[key].splice(i--, 1);
			} else {
				name = originalResolveFilename(babelRE.test(name) ? name : `babel-${key.slice(0, -1)}-${name}`, module);
				if (isArr) {
					conf[key][i][0] = name;
				} else {
					conf[key][i] = name;
				}
			}
		}
	} else {
		delete conf[key];
	}
});

/**
 * Only transpile src and tests.
 *
 * Note that plugins are spawned with cwd of the plugin's directory, not the cwd that the tests are
 * being executed, so we need to apply the APPCD_COVERAGE_CWD path to explicitly specify which
 * directories should be transpiled.
 */
if (process.env.APPCD_COVERAGE) {
	conf.only = [
		path.join(process.env.APPCD_COVERAGE, 'src'),
		path.join(process.env.APPCD_COVERAGE, 'test')
	];
	if (process.env.APPCD_TEST_GLOBAL_PACKAGE_DIR) {
		conf.only.push(new RegExp(`^${process.env.APPCD_COVERAGE}\/(packages|plugins)\/.+\/(src|test)\/`));
	}
} else {
	conf.only = [ 'src', 'test' ];
}

conf.ignore = [ 'test/fixtures' ];

conf.cache = true;

// console.log(conf);

require('@babel/register')(conf);

/**
 * The unit tests reference the source files in the `dist` directory and for coverage tests, they
 * are transpiled on-the-fly, so we need to force them to be resolved in the `src` directory
 * instead.
 */
if (process.env.APPCD_COVERAGE) {
	const cwd = process.cwd();
	const realcwd = fs.realpathSync(cwd);
	const distRegExp = /[\//]dist([\//]|$)/;
	const distGRegExp = /([/\\])dist([/\\]|$)/g;
	const appcdPkg = /^appcd/;

	Module._resolveFilename = function (request, parent, isMain) {
		const parentId = parent && path.resolve(parent.id);

		if (distRegExp.test(request) && (isMain || (parentId && (parentId.startsWith(cwd) || parentId.startsWith(realcwd)) && !parentId.includes('node_modules')))) {
			request = request.replace(distGRegExp, (m, q1, q2) => `${q1}src${q2}`);

		} else if (process.env.APPCD_TEST_GLOBAL_PACKAGE_DIR && appcdPkg.test(request)) {
			const dir = path.resolve(process.env.APPCD_TEST_GLOBAL_PACKAGE_DIR, request);
			try {
				if (fs.statSync(dir).isDirectory()) {
					// built-in package, resolve the main
					// if main is falsey, then it's likely not transpiled anyways
					const { main } = fs.readJsonSync(path.join(dir, 'package.json'));
					if (main) {
						request = path.resolve(dir, main);
						if (distRegExp.test(request)) {
							request = request.replace(distGRegExp, (m, q1, q2) => `${q1}src${q2}`);
						}
					}
				}
			} catch (e) {
				// squelch
			}
		}

		return originalResolveFilename(request, parent, isMain);
	};
}
