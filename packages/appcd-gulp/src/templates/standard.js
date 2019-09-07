'use strict';

module.exports = (opts) => {
	const {
		exports,
		projectDir
	} = opts;

	if (!exports) {
		throw new Error('Missing required "exports" option');
	}

	const $            = require('gulp-load-plugins')();
	const babelConf    = require('../babel')(opts);
	const fs           = require('fs-extra');
	const gulp         = require('gulp');
	const Module       = require('module');
	const path         = require('path');
	const { runTests } = require('../test-runner');

	const coverageDir = path.join(projectDir, 'coverage');
	const distDir     = path.join(projectDir, 'dist');
	const docsDir     = path.join(projectDir, 'docs');

	const { parallel, series } = gulp;

	/*
	 * Inject appcd-gulp into require() search path
	 */
	const appcdGulpNodeModulesPath = path.resolve(__dirname, '../../node_modules');
	const origNodeModulesPaths = Module._nodeModulePaths;
	Module._nodeModulePaths = function (from) {
		return origNodeModulesPaths.call(this, from).concat(appcdGulpNodeModulesPath);
	};

	/*
	 * Clean tasks
	 */
	async function cleanCoverage() { return fs.remove(coverageDir); }
	async function cleanDist() { return fs.remove(distDir); }
	async function cleanDocs() { return fs.remove(docsDir); }
	exports.clean = parallel(cleanCoverage, cleanDist, cleanDocs);

	/*
	 * lint tasks
	 */
	function lint(pattern, eslintFile = 'eslint.json') {
		const baseConfig = require(path.resolve(__dirname, '..', eslintFile));

		// check if the user has a custom .eslintrc in the root of the project
		let custom = path.join(opts.projectDir, '.eslintrc');
		if (fs.existsSync(custom)) {
			(function merge(dest, src) {
				for (const key of Object.keys(src)) {
					if (src[key] && typeof src[key] === 'object' && !Array.isArray(src[key])) {
						if (!dest[key] || typeof dest[key] !== 'object' || Array.isArray(dest[key])) {
							dest[key] = {};
						}
						merge(dest[key], src[key]);
					} else {
						dest[key] = src[key];
					}
				}
			}(baseConfig, JSON.parse(fs.readFileSync(custom))));
		}

		return gulp.src(pattern)
			.pipe($.eslint({ baseConfig }))
			.pipe($.eslint.format())
			.pipe($.eslint.failAfterError());
	}
	function lintSrc() { return lint('src/**/*.js'); }
	function lintTest() { return lint('test/**/test-*.js', 'eslint-tests.json'); }
	exports['lint-src'] = lintSrc;
	exports['lint-test'] = lintTest;
	exports.lint = parallel(
		async function lintSrcWrapper() { return lintSrc(); },
		async function lintTestWrapper() { return lintTest(); }
	);

	/*
	 * build tasks
	 */
	const build = series(
		cleanDist,
		lintSrc,
		function buildWrapper() {
			return gulp.src('src/**/*.js')
				.pipe($.plumber())
				.pipe($.debug({ title: 'build' }))
				.pipe($.sourcemaps.init())
				.pipe($.babel({
					cwd:        __dirname,
					plugins:    babelConf.plugins,
					presets:    babelConf.presets,
					sourceRoot: 'src'
				}))
				.pipe($.sourcemaps.write())
				.pipe(gulp.dest(distDir));
		}
	);
	exports.build = build;
	exports.default = build;

	exports.docs = series(cleanDocs, lintSrc, async () => {
		const esdoc = require('esdoc').default;

		esdoc.generate({
			// debug: true,
			destination: docsDir,
			plugins: [
				{
					name: 'esdoc-standard-plugin',
					option: {
						brand: {
							title:       opts.pkgJson.name,
							description: opts.pkgJson.description,
							respository: 'https://github.com/appcelerator/appc-daemon',
							site:        'https://github.com/appcelerator/appc-daemon'
						}
					}
				},
				{
					name: 'esdoc-ecmascript-proposal-plugin',
					option: {
						all: true
					}
				}
			],
			source: './src'
		});
	});

	/*
	 * test tasks
	 */
	exports.test             = series(lintTest, build,                async function test() {     runTests({ root: appcdGulpNodeModulesPath, projectDir }); });
	exports['test-only']     = series(lintTest,                       async function test() {     runTests({ root: appcdGulpNodeModulesPath, projectDir }); });
	exports.coverage         = series(cleanCoverage, lintTest, build, async function coverage() { runTests({ root: appcdGulpNodeModulesPath, projectDir, cover: true }); });
	exports['coverage-only'] = series(cleanCoverage, lintTest,        async function coverage() { runTests({ root: appcdGulpNodeModulesPath, projectDir, cover: true }); });

	/*
	 * watch tasks
	 */
	exports.watch = series(build, function watch() {
		return new Promise(resolve => {
			const watcher = gulp.watch(`${process.cwd()}/src/**/*.js`, build);
			process.on('uncaughtException', () => {});
			process.on('SIGINT', () => {
				watcher.close();
				resolve();
			});
		});
	});

	exports['watch-test'] = series(build, function watchTest() {
		return new Promise(resolve => {
			const watcher = gulp.watch([ `${process.cwd()}/src/**/*.js`, `${process.cwd()}/test/*.js` ], exports.test);
			process.on('uncaughtException', () => {});
			process.on('SIGINT', () => {
				watcher.close();
				resolve();
			});
		});
	});
};
