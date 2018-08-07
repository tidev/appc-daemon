'use strict';

module.exports = (opts) => {
	require('./standard')(opts);

	const gulp       = opts.gulp;

	const babelConf  = require('../babel')(opts);
	const fs         = require('fs-extra');
	const path       = require('path');
	const webpack    = require('webpack');

	const projectDir  = opts.projectDir;
	const packageName = opts.pkgJson.name;
	const packageFile = path.join(projectDir, `${packageName}.js`);

	gulp.task('clean-package', cb => fs.remove(packageFile, cb));

	gulp.task('package', [ 'clean-package', 'lint-src' ], cb => {
		const compiler = webpack({
			entry: path.resolve(projectDir, opts.pkgJson.main || 'index.js'),
			mode: 'development',
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
			output: {
				filename: `${packageName}.js`,
				path: projectDir
			},
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
