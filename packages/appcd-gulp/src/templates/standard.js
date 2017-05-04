'use strict';

module.exports = (opts) => {
	const gulp = opts.gulp;

	const $ = require('gulp-load-plugins')();
	const babelConfs = require('../babel.json');
	const del = require('del');
	const fs = require('fs');
	const Module = require('module');
	const path = require('path');

	const projectDir = opts.projectDir;
	const coverageDir = path.join(projectDir, 'coverage');
	const distDir = path.join(projectDir, 'dist');
	const docsDir = path.join(projectDir, 'docs');

	/*
	 * Inject appcd-gulp into require() search path
	 */
	const appcdGulpNodeModulesPath = path.resolve(__dirname, '../../node_modules');
	const origNodeModulesPaths = Module._nodeModulePaths;
	Module._nodeModulePaths = function (from) {
		return origNodeModulesPaths.call(this, from).concat(appcdGulpNodeModulesPath);
	};

	/*
	 * Wire up Babel
	 */
	const babelConf = babelConfs[opts.babel] || babelConfs.node4;
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

	/*
	 * Clean tasks
	 */
	gulp.task('clean', ['clean-coverage', 'clean-dist', 'clean-docs']);

	gulp.task('clean-coverage', done => { del([coverageDir]).then(() => done()) });

	gulp.task('clean-dist', done => { del([distDir]).then(() => done()) });

	gulp.task('clean-docs', done => { del([docsDir]).then(() => done()) });

	/*
	 * build tasks
	 */
	gulp.task('build', ['clean-dist', 'lint-src'], () => {
		return gulp
			.src('src/**/*.js')
			.pipe($.plumber())
			.pipe($.debug({ title: 'build' }))
			.pipe($.sourcemaps.init())
			.pipe($.babel({
				plugins: babelConf.plugins,
				presets: babelConf.presets
			}))
			.pipe($.sourcemaps.write('.'))
			.pipe(gulp.dest(distDir));
	});

	gulp.task('docs', ['lint-src', 'clean-docs'], () => {
		return gulp.src('src')
			.pipe($.plumber())
			.pipe($.debug({ title: 'docs' }))
			.pipe($.esdoc({
				// debug: true,
				destination: docsDir,
				plugins: [
					{ name: 'esdoc-es7-plugin' }
				],
				title: opts.pkgJson.name
			}));
	});

	/*
	 * lint tasks
	 */
	function lint(pattern, eslintFile='eslint.json') {
		return gulp.src(pattern)
			.pipe($.plumber())
			.pipe($.eslint(require(path.resolve(__dirname, '..', eslintFile))))
			.pipe($.eslint.format())
			.pipe($.eslint.failAfterError());
	}

	gulp.task('lint-src', () => lint('src/**/*.js'));

	gulp.task('lint-test', () => lint('test/**/test-*.js', 'eslint-tests.json'));

	/*
	 * test tasks
	 */
	gulp.task('test', ['lint-src', 'lint-test'], cb => {
		runTests({
			callback: cb
		});
	});

	gulp.task('coverage', ['lint-src', 'lint-test', 'clean-coverage'], cb => {
		runTests({
			cover: true,
			callback: cb
		});
	});

	function runTests(opts) {
		const setupScript = path.resolve(__dirname, '../test-setup.js');

		gulp.src('src/**/*.js')
			.pipe($.plumber())
			.pipe($.debug({ title: 'build' }))
			.pipe($.sourcemaps.init())
			.pipe($.babel({
				plugins: opts.cover ? babelConf.plugins.concat('istanbul') : babelConf.plugins,
				presets: babelConf.presets
			}))
			.pipe($.sourcemaps.write())
			.pipe($.injectModules())
			.on('finish', () => {
				let stream = gulp.src([setupScript, 'test/**/test*.js'])
					.pipe($.plumber())
					.pipe($.debug({ title: 'test' }))
					.pipe($.sourcemaps.init())
					.pipe($.babel({
						plugins: babelConf.plugins,
						presets: babelConf.presets
					}))
					.pipe($.sourcemaps.write())
					.pipe($.injectModules());

				let p = process.argv.indexOf('--suite');
				if (p !== -1 && p + 1 < process.argv.length) {
					stream = stream.pipe($.filter([ setupScript ].concat(process.argv[p + 1].split(',').map(s => 'test/**/test-' + s + '.js'))));
				}

				p = process.argv.indexOf('--grep');
				let mochaOpts = {
					reporter: 'mocha-jenkins-reporter',
					reporterOptions: {
						junit_report_path: path.join(projectDir, 'junit.xml'),
						junit_report_name: path.basename(projectDir),
					}
				};
				if (p !== -1 && p + 1 < process.argv.length) {
					stream = stream.pipe($.mocha(Object.assign(mochaOpts, { grep: process.argv[p + 1] })));
				} else {
					stream = stream.pipe($.mocha(mochaOpts));
				}

				let error = null;

				stream.once('error', err => {
					error = err;
					opts.callback(err);
				});

				if (opts.cover) {
					stream = stream.pipe($.istanbul.writeReports({ coverageVariable: '__coverage__' }));
				}

				stream.once('end', () => {
					if (!error) {
						opts.callback();
					}
				});
			});
	}

	gulp.task('default', ['build']);
};
