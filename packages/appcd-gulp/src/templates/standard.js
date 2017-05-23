'use strict';

module.exports = (opts) => {
	const gulp = opts.gulp;

	const $           = require('gulp-load-plugins')();
	const babelConfs  = require('../babel.json');
	const del         = require('del');
	const fs          = require('fs');
	const Module      = require('module');
	const path        = require('path');
	const runSequence = require('run-sequence').use(gulp);
	const spawnSync   = require('child_process').spawnSync;

	const projectDir  = opts.projectDir;
	const coverageDir = path.join(projectDir, 'coverage');
	const distDir     = path.join(projectDir, 'dist');
	const docsDir     = path.join(projectDir, 'docs');

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
	process.env.APPCD_BABEL_CONF = babelConfs[opts.babel] ? opts.babel : 'node4';

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
	 * build tasks
	 */
	gulp.task('build', ['clean-dist', 'lint-src'], () => {
		return gulp.src('src/**/*.js')
			.pipe($.plumber())
			.pipe($.debug({ title: 'build' }))
			.pipe($.sourcemaps.init())
			.pipe($.babel({
				plugins: babelConf.plugins,
				presets: babelConf.presets
			}))
			.pipe($.sourcemaps.write())
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
	 * test tasks
	 */
	gulp.task('test', ['lint-src', 'lint-test'], cb => runTests({ callback: cb }));
	gulp.task('coverage', ['lint-src', 'lint-test', 'clean-coverage'], cb => runTests({ cover: true, callback: cb }));

	function runTests(opts) {
		const args = [];

		if (opts.cover) {
			args.push(path.join(appcdGulpNodeModulesPath, '.bin', 'nyc'));
			args.push('--reporter=text', '--reporter=html');
			args.push('mocha');
		} else {
			args.push(path.join(appcdGulpNodeModulesPath, '.bin', 'mocha'));
		}

		args.push('--reporter=' + path.join(appcdGulpNodeModulesPath, 'mocha-jenkins-reporter'));
		process.env.JUNIT_REPORT_PATH = path.join(projectDir, 'junit.xml');
		process.env.JUNIT_REPORT_NAME = path.basename(projectDir);

		let p = process.argv.indexOf('--grep');
		if (p !== -1 && p + 1 < process.argv.length) {
			args.push('--grep', process.argv[p + 1]);
		}

		args.push(path.resolve(__dirname, '../test-setup.js'));

		p = process.argv.indexOf('--suite');
		if (p !== -1 && p + 1 < process.argv.length) {
			args.push.apply(args, process.argv[p + 1].split(',').map(s => 'test/**/test-' + s + '.js'));
		} else {
			args.push('test/**/test-*.js');
		}

		// console.log(args);

		spawnSync(process.execPath, args, { stdio: 'inherit' });

		opts.callback();
	}

	gulp.task('default', ['build']);
};
