'use strict';

module.exports = (opts) => {
	require('./standard')(opts);

	const {
		exports,
		projectDir
	} = opts;

	const babelConf   = require('../babel')(opts);
	const fs          = require('fs-extra');
	const gulp        = require('gulp');
	const path        = require('path');

	const entry       = path.resolve(projectDir, opts.webpack?.entry || opts.pkgJson.main || 'index.js');
	const outDir      = path.join(projectDir, 'out');

	if (!fs.existsSync(entry)) {
		throw new Error('Unable to determine package main entry file');
	}

	exports['clean-package'] = () => fs.remove(outDir);

	/**
	 * The `package` task is meant to bundle all files into a single .js file.
	 *
	 * However, this is currently borked. There are a number of problems:
	 *
	 * 1. By default, Webpack will not resolve `__dirname` and `__filename`. If we enable those
	 * paths to be resolved, then it will populate them with relative paths to the project root,
	 * not the output bundle. So, we have a custom NodejsPathResolver, that wraps the relative path
	 * with a function that resolves the proper absolute path.
	 *
	 * 2. For some reason, Webpack strips all `require.resolve()` calls and replaces them with the
	 * module id. This is happening in Webpack's CommonJS plugin. No idea if there's a workaround.
	 *
	 * 3. This task will only handle .js code, not additional resources. This task needs a
	 * parameter that allows each program to specify which files to copy into the output directory
	 * including templates, static files, etc.
	 *
	 * 4. The current method for injecting the runtime resolver is super hacky. I'm sure there's a
	 * better way to do it besides abusing the banner plugin.
	 */
	exports.package = gulp.series(
		exports['clean-package'],

		exports.build,

		async function pkg() {
			const packageName           = opts.pkgJson.name;
			const webpack               = require('webpack');
			const CachedConstDependency = require('webpack/lib/dependencies/CachedConstDependency');
			const { evaluateToString }  = require("webpack/lib/javascript/JavascriptParserHelpers");
			const { relative }          = require('webpack/lib/util/fs');

			console.log(`Project directory: ${projectDir}`);
			console.log(`Main entry:        ${entry}`);
			console.log(`Out file:          ${path.join(outDir, packageName)}.js`);
			console.log('Babel config:',    babelConf);
			console.log();

			class NodejsPathResolver {
				apply(compiler) {
					compiler.hooks.compilation.tap(
						'NodejsPathResolver',
						(compilation, { normalModuleFactory }) => {
							normalModuleFactory.hooks.parser
								.for('javascript/auto')
								.tap('NodejsPathResolver', parser => {
									for (const variable of [ '__dirname', '__filename' ]) {
										parser.hooks.expression
											.for(variable)
											.tap('NodejsPathResolver', expression => {
												const relPath = relative(compiler.inputFileSystem, outDir, parser.state.module.context);
												const newExpression = `__appcd_resolve__(${JSON.stringify(relPath)})`;
												const dep = new CachedConstDependency(newExpression, expression.range, variable);
												dep.loc = expression.loc;
												parser.state.module.addPresentationalDependency(dep);
												return true;
											});

										parser.hooks.evaluateIdentifier
											.for(variable)
											.tap('NodejsPathResolver', expr => {
												if (parser.state.module) {
													return evaluateToString(parser.state.module.context)(expr);
												}
											});
									}
								});
						}
					);
				}
			}

			// TODO: use copy-webpack-plugin to copy bryt lookup tables and cli-kit help template

			const compiler = webpack({
				context: projectDir,
				entry,
				module: {
					rules: [
						{
							test: /\.js$/,
							exclude: /node_modules/,
							use: {
								loader: 'babel-loader',
								options: babelConf
							}
						}
					]
				},
				// node: {
				// 	__dirname: true,
				// 	__filename: true
				// },
				optimization: {
					minimize: false
				},
				output: {
					filename: `${packageName}.js`,
					path: outDir
				},
				plugins: [
					new NodejsPathResolver(),
					// new webpack.ProvidePlugin({
					// 	__appcd_resolve__: path.join(__dirname, 'webpack2', 'resolve2')
					// })
					new webpack.BannerPlugin({
						banner: `#!/usr/bin/env node
const __appcd_resolve__ = (() => {
	const path = require('path');
	const cwd = __dirname;
	return rel => path.resolve(cwd, rel);
})();`,
						include: new RegExp(opts.pkgJson.name),
						raw: true
					})
					// new webpack.BannerPlugin({
					// 	banner: '#!/usr/bin/env node',
					// 	include: new RegExp(opts.pkgJson.name),
					// 	raw: true
					// })
				],
				target: 'node'
			});

			return new Promise(resolve => {
				compiler.run((err, stats) => {
					if (err) {
						console.error(err);
						return resolve();
					}

					if (stats.hasErrors()) {
						let i = 0;
						for (const err of stats.compilation.errors) {
							i++ || console.error();
							console.error(err);
						}
						return resolve();
					}

					console.log('Discovered dependencies:');
					for (const file of stats.compilation.fileDependencies) {
						console.log('  ' + file);
					}

					resolve();
				});
			});
		}
	);
};
