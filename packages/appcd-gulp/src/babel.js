const fs     = require('fs');
const Module = require('module');
const path   = require('path');

const profiles = {
	node4: {
		plugins: [
			'@babel/plugin-proposal-class-properties',
			'@babel/plugin-proposal-object-rest-spread',
			'@babel/plugin-transform-async-to-generator',
			'@babel/plugin-transform-destructuring',
			'@babel/plugin-transform-modules-commonjs',
			'@babel/plugin-transform-parameters',
			'dynamic-import-node'
		]
	},

	node6: {
		plugins: [
			'@babel/plugin-proposal-class-properties',
			'@babel/plugin-proposal-object-rest-spread',
			'@babel/plugin-transform-async-to-generator',
			'@babel/plugin-transform-destructuring',
			'@babel/plugin-transform-modules-commonjs',
			'dynamic-import-node'
		]
	},

	node7: {
		plugins: [
			'@babel/plugin-proposal-class-properties',
			'@babel/plugin-proposal-object-rest-spread',
			'@babel/plugin-transform-modules-commonjs',
			'dynamic-import-node'
		]
	},

	node8: {
		plugins: [
			'@babel/plugin-proposal-class-properties',
			'@babel/plugin-proposal-object-rest-spread',
			'@babel/plugin-transform-modules-commonjs',
			'dynamic-import-node'
		]
	},

	node10: {
		plugins: [
			'@babel/plugin-proposal-class-properties',
			'@babel/plugin-transform-modules-commonjs',
			'dynamic-import-node'
		]
	}
};

module.exports = function getBabelConf(opts) {
	const name = process.env.APPCD_BABEL_CONF = [
		opts && opts.babel,
		process.env.APPCD_BABEL_CONF,
		'node8'
	].reduce((p, n) => !p && n && profiles[n] ? n : p);

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
		}(opts && opts.projectDir || process.cwd()));
	}

	return babelConf;
};
