const fs = require('fs');
const Module = require('module');
const path = require('path');

const babelRE = /^(babel-\w+-)/;
const babel = require('./babel.json');
const conf = babel[process.env.APPCD_BABEL_CONF || 'node8'] || {};
const originalResolveFilename = Module._resolveFilename;

if (process.env.APPCD_COVERAGE && conf.plugins.indexOf('istanbul') === -1) {
	// inject the istanbul babel plugin
	conf.plugins.unshift([
		'istanbul',
		{ exclude: 'test' }
	]);
}

// remove babili from tests and resolve all babel plugins/presets
Object.keys(conf).forEach(function (key) {
	if ((key === 'plugins' || key === 'presets') && Array.isArray(conf[key])) {
		for (var i = 0; i < conf[key].length; i++) {
			const isArr = Array.isArray(conf[key][i]);
	 		let name = isArr ? conf[key][i][0] : conf[key][i];
			if (name.indexOf('babili') !== -1) {
				conf[key].splice(i--, 1);
			} else {
				name = originalResolveFilename(babelRE.test(name) ? name : 'babel-' + key.slice(0, -1) + '-' + name, module);
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

// only transpile src and tests
conf.only = [ 'src/', 'test/' ];

conf.ignore = [ 'test/fixtures' ];

conf.cache = true;

// console.log(conf);

require('babel-register')(conf);
require('babel-polyfill');

/**
 * The unit tests reference the source files in the `dist` directory and for coverage tests, they
 * are transpiled on-the-fly, so we need to force them to be resolved in the `src` directory
 * instead.
 */
if (process.env.APPCD_COVERAGE) {
	const cwd = process.cwd();
	const realcwd = fs.realpathSync(cwd);
	const distDir = path.join(cwd, 'dist');
	const srcDir = path.join(cwd, 'src');

	Module._resolveFilename = function (request, parent, isMain) {
		if (parent && (parent.id.indexOf(cwd) === 0 || parent.id.indexOf(realcwd) === 0)) {
			request = request.replace(/([/\\])dist([/\\])/, (m, q1, q2) => `${q1}src${q2}`);
		}
		return originalResolveFilename(request, parent, isMain);
	};
}
