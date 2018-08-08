'use strict';

module.exports = (opts) => {
	require('./standard')(opts);

	const gulp        = opts.gulp;

	const babelConf   = require('../babel')(opts);
	const fs          = require('fs-extra');
	const path        = require('path');
	const webpack     = require('webpack');

	const projectDir  = opts.projectDir;
	const packageName = opts.pkgJson.name;
	const outDir      = path.join(projectDir, 'out');

	gulp.task('clean-package', cb => fs.remove(outDir, cb));

	gulp.task('package', [ 'clean-package', 'build' ], cb => {
		const compiler = webpack({
			entry: path.resolve(projectDir, opts.pkgJson.main || 'index.js'),
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
			node: {
				__dirname: true,
				__filename: true
			},
			optimization: {
				// minimize: false
			},
			output: {
				filename: `${packageName}.js`,
				// filename: packageName,
				path: outDir
			},
			plugins: [
				// new webpack.BannerPlugin({
				// 	banner: '#!/usr/bin/env node',
				// 	include: new RegExp(opts.pkgJson.name),
				// 	raw: true
				// })
			],
			target: 'node'
		});

		compiler.run((err, stats) => {
			if (err) {
				console.error(err);
				return cb();
			}

			if (stats.hasErrors()) {
				let i = 0;
				for (const err of stats.compilation.errors) {
					i++ || console.error();
					console.error(err);
				}
				return cb();
			}

			for (const file of stats.compilation.fileDependencies) {
				console.log(file.replace(__dirname, ''));
			}

			cb();
		});
	});
};
