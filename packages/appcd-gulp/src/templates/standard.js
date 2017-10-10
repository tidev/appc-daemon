'use strict';

module.exports = (opts) => {
	const gulp = opts.gulp;

	const $           = require('gulp-load-plugins')();
	const babelConfs  = require('../babel.json');
	const del         = require('del');
	const fs          = require('fs');
	const Module      = require('module');
	const path        = require('path');
	const spawnSync   = require('child_process').spawnSync;

	const projectDir  = opts.projectDir;
	const coverageDir = path.join(projectDir, 'coverage');
	const distDir     = path.join(projectDir, 'dist');
	const docsDir     = path.join(projectDir, 'docs');

	const isWindows = process.platform === 'win32';

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
			.pipe($.eslint({
				configFile: path.resolve(__dirname, '..', eslintFile)
			}))
			.pipe($.eslint.format())
			.pipe($.eslint.failAfterError());
	}

	gulp.task('lint', [ 'lint-src', 'lint-test' ]);

	gulp.task('lint-src', () => lint('src/**/*.js'));

	gulp.task('lint-test', () => lint('test/**/test-*.js', 'eslint-tests.json'));

	/*
	 * build tasks
	 */
	gulp.task('build', ['clean-dist', 'lint-src'], () => {
		return gulp.src('src/**/*.js')
			.pipe($.plumber())
			.pipe($.debug({ title: 'build' }))
			.pipe($.babel({
				plugins: babelConf.plugins,
				presets: babelConf.presets,
				sourceMaps: 'inline',
				sourceRoot: path.join(opts.projectDir, 'src')
			}))
			.pipe(gulp.dest(distDir));
	})

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
	gulp.task('test', ['build', 'lint-test'], () => runTests());
	gulp.task('test-only', ['lint-test'], () => runTests());
	gulp.task('coverage', ['clean-coverage', 'lint-src', 'lint-test'], () => runTests(true));
	gulp.task('coverage-only', ['clean-coverage', 'lint-test'], () => runTests(true));

	function runTests(cover) {
		const args = [];
		let execPath;
		// add nyc
		if (cover) {
			if (isWindows) {
				execPath = path.join(appcdGulpNodeModulesPath, '.bin', 'nyc.cmd');
			} else {
				execPath = process.execPath;
				args.push(path.join(appcdGulpNodeModulesPath, '.bin', 'nyc'))

			}
			args.push(
				'--cache', 'false',
				'--exclude', 'test',
				'--instrument', 'false',
				'--source-map', 'false',
				// supported reporters:
				//   https://github.com/istanbuljs/istanbuljs/tree/master/packages/istanbul-reports/lib
				'--reporter=html',
				'--reporter=json',
				'--reporter=text',
				'--reporter=text-summary',
				'--require', path.resolve(__dirname, '../test-transpile.js'),
				'--show-process-tree',
			);
			if (!isWindows) {
				args.push(process.execPath); // need to specify node here so that spawn-wrap works
			}
			process.env.FORCE_COLOR = 1;
			process.env.APPCD_COVERAGE = 1;
		}

		// add mocha
		if (!cover && isWindows) {
			execPath = path.join(appcdGulpNodeModulesPath, '.bin', 'mocha.cmd');
		} else {
			if (isWindows) {
				args.push(path.join(appcdGulpNodeModulesPath, '.bin', 'mocha.cmd'));
			} else {
				args.push(path.join(appcdGulpNodeModulesPath, '.bin', 'mocha'));
			}
		}

		// add --inspect
		if (process.argv.indexOf('--inspect') !== -1 || process.argv.indexOf('--inspect-brk') !== -1) {
			args.push('--inspect-brk');
		}

		args.push('--reporter=' + path.join(appcdGulpNodeModulesPath, 'mocha-jenkins-reporter'));
		process.env.JUNIT_REPORT_PATH = path.join(projectDir, 'junit.xml');
		process.env.JUNIT_REPORT_NAME = path.basename(projectDir);

		// add grep
		let p = process.argv.indexOf('--grep');
		if (p !== -1 && p + 1 < process.argv.length) {
			args.push('--grep', process.argv[p + 1]);
		}

		// add transpile setup
		if (!cover) {
			args.push(path.resolve(__dirname, '../test-transpile.js'));
		}

		// add unit test setup
		args.push(path.resolve(__dirname, '../test-setup.js'));

		// add suite
		p = process.argv.indexOf('--suite');
		if (p !== -1 && p + 1 < process.argv.length) {
			args.push.apply(args, process.argv[p + 1].split(',').map(s => 'test/**/test-' + s + '.js'));
		} else {
			args.push('test/**/test-*.js');
		}

		$.util.log('Running: ' + $.util.colors.cyan(execPath + ' ' + args.join(' ')));

		// run!
		spawnSync(execPath, args, { stdio: 'inherit' });
	}

	gulp.task('default', ['build']);
};
