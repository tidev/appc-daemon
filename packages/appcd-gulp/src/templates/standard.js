'use strict';

module.exports = (opts) => {
	const gulp = opts.gulp;

	const $           = require('gulp-load-plugins')();
	const babelConfs  = require('../babel.json');
	const del         = require('del');
	const fs          = require('fs');
	const globule     = require('globule');
	const Module      = require('module');
	const path        = require('path');
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
	gulp.task('build', ['clean-dist', 'lint-src'], () => build());
	gulp.task('build-coverage', ['clean-dist', 'lint-src'], () => build(true));

	function build(cover) {
		const plugins = babelConf.plugins;
		if (cover) {
			plugins.push('istanbul');
			try {
				fs.mkdirSync(distDir);
			} catch (e) {}
			fs.writeFileSync(path.join(distDir, '.covered'), '');
		}

		return gulp.src('src/**/*.js')
			.pipe($.plumber())
			.pipe($.debug({ title: 'build' }))
			.pipe($.sourcemaps.init())
			.pipe($.babel({
				plugins: plugins,
				presets: babelConf.presets
			}))
			.pipe($.sourcemaps.write())
			.pipe(gulp.dest(distDir));
	}

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
	gulp.task('test', ['build', 'check-deps', 'lint-test'], cb => runTests(false, cb));
	gulp.task('coverage', ['build-coverage', 'check-deps', 'clean-coverage', 'lint-test'], cb => runTests(true, cb));

	gulp.task('check-deps', cb => {
		if (!opts.pkgJson || !Array.isArray(opts.pkgJson.appcdDependencies)) {
			return cb();
		}

		const depmap = {};
		const root = path.resolve(__dirname, '..', '..', '..', '..');
		let pkg;
		const pkgs = [];
		const packages = [];

		// build the dependency map
		globule
			.find(['./*/package.json', 'packages/*/package.json', '!packages/appcd-gulp/*', 'plugins/*/package.json'], { srcBase: '../..' })
			.forEach(pkgJsonFile => {
				pkgJsonFile = path.resolve('..', '..', pkgJsonFile);
				const dir = path.dirname(pkgJsonFile);
				let name = path.relative(root, dir);
				const pkgJson = JSON.parse(fs.readFileSync(pkgJsonFile));
				if (opts.pkgJson.appcdDependencies.indexOf(pkgJson.name) !== -1) {
					pkgs.push(name);
				}
				if (Array.isArray(pkgJson.appcdDependencies)) {
					depmap[name] = pkgJson.appcdDependencies.map(d => `packages/${d}`);
				}
			});

		// sort the list of appcd dependencies
		while (pkg = pkgs.shift()) {
			const deps = (function getDeps(pkg) {
				const list = depmap[pkg] || [];
				for (const dep of list) {
					for (const depdep of getDeps(dep)) {
						if (list.indexOf(depdep) === -1) {
							list.push(depdep);
						}
					}
				}
				return list;
			}(pkg));

			let insertAt = -1;
			for (let i = 0; i < deps.length; i++) {
				const p = packages.indexOf(deps[i]);
				if (p !== -1 && p > insertAt) {
					insertAt = p + 1;
				}
			}

			insertAt = Math.max(insertAt, 0);
			packages.splice(insertAt, 0, pkg);
		}

		const needsBuild = [];

		for (pkg of packages) {
			const distDir = path.join(root, pkg, 'dist');
			try {
				fs.statSync(distDir);

				try {
					fs.statSync(path.join(distDir, '.covered'))
				} catch (e) {
					continue;
				}

				throw new Error();
			} catch (e) {
				needsBuild.push(path.join(root, pkg, 'gulpfile.js'));
			}
		}

		if (!needsBuild.length) {
			return cb();
		}

		$.util.log('Following dependencies must be re-built:');
		needsBuild.forEach(p => $.util.log('  ' + $.util.colors.cyan(p)));

		gulp
			.src(needsBuild)
			.pipe($.chug({ tasks: ['build'] }))
			.on('finish', () => cb());
	});

	function runTests(cover, callback) {
		const args = [];
		if (cover) {
			args.push(
				path.resolve(__dirname, '..', 'run-nyc.js'),
				path.join(appcdGulpNodeModulesPath, '.bin', 'nyc'),
				'--exclude', 'dist',
				'--exclude', 'test',
				'--reporter=text',
				'--reporter=html',
				'--reporter=json',
				'--show-process-tree',
				process.execPath,
				path.join(appcdGulpNodeModulesPath, '.bin', 'mocha')
			);
			process.env.FORCE_COLOR = 1;
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

		callback();
	}

	gulp.task('default', ['build']);
};
