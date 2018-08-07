const fs     = require('fs');
const Module = require('module');
const path   = require('path');

const profiles = {
	"node4": {
		"plugins": [
			"dynamic-import-node",
			"@babel/plugin-transform-async-to-generator",
			"transform-class-properties",
			"transform-decorators-legacy",
			"transform-es2015-destructuring",
			"transform-es2015-modules-commonjs",
			"transform-es2015-parameters",
			"transform-object-rest-spread"
		],
		"xpresets": [
			"minify"
		]
	},

	"node6": {
		"plugins": [
			"dynamic-import-node",
			"@babel/plugin-transform-async-to-generator",
			"transform-class-properties",
			"transform-decorators-legacy",
			"transform-es2015-destructuring",
			"transform-es2015-modules-commonjs",
			"transform-object-rest-spread"
		],
		"xpresets": [
			"minify"
		]
	},

	"node7": {
		"plugins": [
			"dynamic-import-node",
			"transform-class-properties",
			"transform-decorators-legacy",
			"transform-es2015-modules-commonjs",
			"transform-object-rest-spread"
		],
		"xpresets": [
			"minify"
		]
	},

	"node8": {
		"plugins": [
			"dynamic-import-node",
			"transform-class-properties",
			"transform-decorators-legacy",
			"transform-es2015-modules-commonjs",
			"transform-object-rest-spread"
		],
		"xpresets": [
			"minify"
		]
	}
};

module.exports = function getBabelConf(opts) {
	const name = profiles[opts.babel] ? opts.babel : 'node8';
	process.env.APPCD_BABEL_CONF = name;

	const babelConf = profiles[name];

	for (let plugin of babelConf.plugins) {
		plugin = `babel-plugin-${plugin}`;
		(function inject(dir) {
			for (const name of fs.readdirSync(dir)) {
				const subdir = path.join(dir, name);
				try {
					if (fs.statSync(subdir).isDirectory()) {
						const resolvedModule = Module._resolveLookupPaths(plugin, {
							filename: plugin,
							paths: Module._nodeModulePaths(subdir)
						});
						const cacheKey = JSON.stringify({
							request: plugin,
							paths: resolvedModule[1]
						});
						Module._pathCache[cacheKey] = require.resolve(plugin);
						// inject(subdir);
					}
				} catch (e) {}
			}
		}(opts.projectDir));
	}

	delete babelConf.xpresets;

	return babelConf;
};
